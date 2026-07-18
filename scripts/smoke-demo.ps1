[CmdletBinding()]
param(
  [string]$WebUrl = "http://localhost:3000",
  [string]$ApiUrl = "http://localhost:4000/api",
  [string]$AiUrl = "http://localhost:8001"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-HttpJson {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Uri,
    [object]$Body = $null,
    [int]$TimeoutSec = 15,
    [hashtable]$ExtraHeaders = @{}
  )

  $requestHeaders = @{ Accept = "application/json" }
  foreach ($headerName in $ExtraHeaders.Keys) {
    $requestHeaders[$headerName] = $ExtraHeaders[$headerName]
  }

  $request = @{
    Uri = $Uri
    Method = $Method
    UseBasicParsing = $true
    TimeoutSec = $TimeoutSec
    Headers = $requestHeaders
    ErrorAction = "Stop"
  }
  if ($null -ne $Body) {
    $request.ContentType = "application/json"
    $request.Body = ConvertTo-Json -InputObject $Body -Depth 20 -Compress
  }

  try {
    $response = Invoke-WebRequest @request
  } catch {
    $details = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $details = "$details | $($_.ErrorDetails.Message)"
    }
    throw "$Label failed at $Uri. $details"
  }

  if ([string]::IsNullOrWhiteSpace($response.Content)) {
    return $null
  }
  try {
    return $response.Content | ConvertFrom-Json
  } catch {
    throw "$Label returned non-JSON content from $Uri."
  }
}

function Assert-ServiceReady {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Uri,
    [switch]$Json
  )

  try {
    if ($Json) {
      $health = Invoke-HttpJson "$Name health check" "GET" $Uri
      if ($health.status -ne "ok") {
        throw "Unexpected health payload."
      }
    } else {
      $response = Invoke-WebRequest -Uri $Uri -Method GET -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
      if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
        throw "HTTP $($response.StatusCode)"
      }
    }
  } catch {
    throw "$Name is not ready at $Uri. Start all services with 'npm run dev', wait for the three startup messages, and retry. $($_.Exception.Message)"
  }
  Write-Host "[OK] $Name is ready." -ForegroundColor Green
}

function Assert-Equal {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [object]$Actual,
    [object]$Expected
  )

  if ($Actual -ne $Expected) {
    throw "$Label expected '$Expected' but received '$Actual'."
  }
}

try {
  Write-Host "EduRecall full HTTP smoke test" -ForegroundColor Cyan
  Assert-ServiceReady "Web" $WebUrl
  Assert-ServiceReady "Core API" "$ApiUrl/health" -Json
  Assert-ServiceReady "AI service" "$AiUrl/health" -Json

  $null = Invoke-HttpJson "Demo reset" "POST" "$ApiUrl/health/demo-reset" @{}
  Write-Host "[OK] Demo memory store reset." -ForegroundColor Green

  $studentSession = Invoke-HttpJson "Student login" "POST" "$ApiUrl/auth/login" @{ email = "minh@edurecall.local"; password = "Demo@123" }
  $teacherSession = Invoke-HttpJson "Teacher login" "POST" "$ApiUrl/auth/login" @{ email = "teacher@edurecall.local"; password = "Demo@123" }
  $studentHeaders = @{ Authorization = "Bearer $($studentSession.accessToken)" }
  $teacherHeaders = @{ Authorization = "Bearer $($teacherSession.accessToken)" }
  Write-Host "[OK] Student and teacher JWTs issued." -ForegroundColor Green

  $idempotencyKey = "smoke-range-$([guid]::NewGuid().ToString('N'))"
  $attemptBody = @{
    idempotencyKey = $idempotencyKey
    studentId = "student-minh"
    domainCode = "python-foundations"
    courseId = "course-python"
    conceptCode = "PYTHON_RANGE"
    activityId = "practice-range-predict-01"
    lessonPhase = "PRACTICE"
    isCorrect = $false
    usedHint = $false
    skipped = $false
    attemptNumber = 1
    difficulty = 0.45
    responseTimeMs = 12500
    submittedAnswer = "1, 2, 3, 4, 5"
    expectedAnswer = "1, 2, 3, 4"
    stopValue = 5
    prerequisiteMastery = 0.72
  }
  $attempt = Invoke-HttpJson "Submit range attempt" "POST" "$ApiUrl/attempts" $attemptBody 20 $studentHeaders
  Assert-Equal "Attempt status" $attempt.status "ANALYZED"
  Assert-Equal "Personalization mode" $attempt.analysis.mode "AI_SERVICE"
  Assert-Equal "Misconception" $attempt.analysis.diagnosis.misconception_code "RANGE_STOP_INCLUDED"
  Assert-Equal "Attempt recommendation" $attempt.analysis.recommendation.action "MICRO_LESSON"
  Write-Host "[OK] Attempt analyzed by FastAPI as RANGE_STOP_INCLUDED." -ForegroundColor Green

  $recommendation = Invoke-HttpJson "Fetch recommendation log" "GET" "$ApiUrl/teacher/recommendations/$($attempt.id)" $null 15 $teacherHeaders
  Assert-Equal "Recommendation action" $recommendation.recommendation.action "MICRO_LESSON"
  Assert-Equal "Recommendation diagnosis" $recommendation.diagnosis.misconception_code "RANGE_STOP_INCLUDED"
  Write-Host "[OK] Explainable recommendation log returned." -ForegroundColor Green

  $generationBody = @{
    domainCode = "python-foundations"
    conceptCode = "PYTHON_RANGE"
    misconceptionCode = "RANGE_STOP_INCLUDED"
    level = "Mới bắt đầu"
    learningObjective = "Giải thích được vì sao giá trị stop không thuộc dãy range() trong Python."
    durationMinutes = 5
    sourceId = "source-python-handbook-01"
    provider = "LOCAL_TEMPLATE"
  }
  $draft = Invoke-HttpJson "Generate structured draft" "POST" "$ApiUrl/ai/content/generate" $generationBody 20 $teacherHeaders
  Assert-Equal "Generated content status" $draft.status "DRAFT"
  Assert-Equal "Generated content provider" $draft.provider "LOCAL_TEMPLATE"
  Write-Host "[OK] Structured DRAFT generated and validated." -ForegroundColor Green

  $approved = Invoke-HttpJson "Approve generated content" "POST" "$ApiUrl/teacher/generated-content/$($draft.id)/approve" @{ comment = "Smoke test teacher approval" } 15 $teacherHeaders
  Assert-Equal "Approved content status" $approved.status "APPROVED"
  Write-Host "[OK] Human-review approval transition completed." -ForegroundColor Green

  $published = Invoke-HttpJson "Publish approved content" "POST" "$ApiUrl/teacher/generated-content/$($draft.id)/publish" @{ comment = "Smoke test publication" } 15 $teacherHeaders
  Assert-Equal "Published content status" $published.status "PUBLISHED"
  Write-Host "[OK] Content published." -ForegroundColor Green

  $studentLesson = Invoke-HttpJson "Read published student lesson" "GET" "$ApiUrl/micro-lessons/$($draft.id)" $null 15 $studentHeaders
  Assert-Equal "Student lesson status" $studentLesson.status "PUBLISHED"

  $quiz = Invoke-HttpJson "Complete micro-lesson quiz" "POST" "$ApiUrl/micro-lessons/$($draft.id)/quiz" @{ selectedIndex = 0 } 15 $studentHeaders
  Assert-Equal "Quiz result" $quiz.correct $true
  if ([double]$quiz.masteryAfter -le [double]$quiz.masteryBefore) {
    throw "Quiz mastery was expected to increase, but changed from $($quiz.masteryBefore) to $($quiz.masteryAfter)."
  }
  Write-Host "[OK] Quiz completed; mastery $($quiz.masteryBefore) -> $($quiz.masteryAfter)." -ForegroundColor Green

  Write-Host ""
  Write-Host "SMOKE PASSED: web -> API -> FastAPI -> recommendation -> draft -> approve -> publish -> quiz" -ForegroundColor Green
  Write-Host "Note: this smoke test intentionally uses the API's process-memory demo store, not PostgreSQL."
} catch {
  Write-Host ""
  Write-Host "SMOKE FAILED: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
