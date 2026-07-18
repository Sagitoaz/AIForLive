[CmdletBinding()]
param([string]$ApiUrl = "http://localhost:4000/api")
$ErrorActionPreference = "Stop"
function Call([string]$Method,[string]$Path,[object]$Body=$null,[hashtable]$Headers=@{}) {
  $request=@{Uri="$ApiUrl$Path";Method=$Method;UseBasicParsing=$true;TimeoutSec=40;Headers=$Headers}
  if($null-ne $Body){$request.ContentType="application/json";$request.Body=$Body|ConvertTo-Json -Depth 20 -Compress}
  (Invoke-WebRequest @request).Content|ConvertFrom-Json
}
$health=Call "GET" "/health"
if($health.dependencies.database-ne"supabase-postgresql-ready"){throw "API is not using Supabase PostgreSQL"}
$student=Call "POST" "/auth/login" @{email="minh@edurecall.local";password="Demo@123"}
$teacher=Call "POST" "/auth/login" @{email="teacher@edurecall.local";password="Demo@123"}
$studentHeaders=@{Authorization="Bearer $($student.accessToken)"}
$teacherHeaders=@{Authorization="Bearer $($teacher.accessToken)"}
$dashboard=Call "GET" "/students/me/dashboard" $null $studentHeaders
$course=Call "GET" "/courses/$($dashboard.course.id)" $null $studentHeaders
$completedLessons=@($course.modules.lessons|Where-Object {$_.status-eq"COMPLETED"})
$currentLessons=@($course.modules.lessons|Where-Object {$_.status-eq"CURRENT"})
if($completedLessons.Count-eq0-or$currentLessons.Count-eq0){throw "Course progress must expose COMPLETED and CURRENT lessons"}
$rangeLesson=$course.modules.lessons|Where-Object {$_.conceptCode-eq"PYTHON_RANGE"}|Select-Object -First 1
$lesson=Call "GET" "/lessons/$($rangeLesson.id)" $null $studentHeaders
$animations=@($lesson.sections.resources|Where-Object {$_.presentation.mode-eq"ANIMATION"})
if($animations.Count-eq0){throw "Range lesson has no rendered animation spec"}
$exercise=$lesson.sections.activities|Where-Object {$_.code-eq"EX-08-1"}|Select-Object -First 1
$attemptBody=@{idempotencyKey="smoke-$([guid]::NewGuid().ToString('N'))";domainCode="python-foundations";courseId=$dashboard.course.id;conceptCode="PYTHON_RANGE";activityId=$exercise.id;lessonPhase="PRACTICE";isCorrect=$false;usedHint=$false;skipped=$false;attemptNumber=1;difficulty=$exercise.difficulty;responseTimeMs=12500;submittedAnswer="1,2,3,4,5";expectedAnswer="server-owned";prerequisiteMastery=.6}
$attempt=Call "POST" "/attempts" $attemptBody $studentHeaders
if($attempt.analysis.diagnosis.misconception_code-ne"RANGE_STOP_INCLUDED"){throw "Expected RANGE_STOP_INCLUDED"}
$recommendations=Call "GET" "/students/me/recommendations" $null $studentHeaders
$null=Call "GET" "/teacher/recommendations/$($recommendations[0].id)" $null $teacherHeaders
$sources=Call "GET" "/content-sources" $null $teacherHeaders
$verifiedSource=$sources|Where-Object {$_.status-eq"VERIFIED"}|Select-Object -First 1
if(-not$verifiedSource){throw "No VERIFIED content source"}
$generation=@{domainCode="python-foundations";conceptCode="PYTHON_RANGE";misconceptionCode="RANGE_STOP_INCLUDED";level="BEGINNER";learningObjective="Explain why stop is excluded from range";durationMinutes=65;draftKind="FULL_LESSON";gradeBand="GRADE_6_9";sourceId=$verifiedSource.id;provider="LOCAL_TEMPLATE"}
$content=Call "POST" "/ai/content/generate" $generation $teacherHeaders
if($content.status-eq"DRAFT"){
  $content=Call "POST" "/teacher/generated-content/$($content.id)/review" @{comment="Smoke submit review"} $teacherHeaders
  $content=Call "POST" "/teacher/generated-content/$($content.id)/approve" @{comment="Smoke review"} $teacherHeaders
  $content=Call "POST" "/teacher/generated-content/$($content.id)/publish" @{comment="Smoke publish"} $teacherHeaders
}
$publishedContent=Call "GET" "/micro-lessons/$($content.id)" $null $studentHeaders
if(@($publishedContent.practiceQuestions).Count-lt3){throw "Personalized lesson needs at least 3 reinforcement questions"}

$teacherDashboard=Call "GET" "/teacher/dashboard" $null $teacherHeaders
$planInput=@{courseId=$dashboard.course.id;classId=$teacherDashboard.class.id;title="Lộ trình smoke Python";gradeBand="Lớp 6-9";goals=@("Nắm nền tảng Python","Hoàn thành sản phẩm nhỏ");durationWeeks=8}
$plan=Call "POST" "/teacher/course-plans/generate" $planInput $teacherHeaders
if($plan.status-ne"DRAFT"-or@($plan.planJson.explainability.candidateLog).Count-eq0){throw "Course planner did not persist an explainable DRAFT"}
$plan=Call "POST" "/teacher/course-plans/$($plan.id)/submit-review" @{comment="Smoke submit plan"} $teacherHeaders
$plan=Call "POST" "/teacher/course-plans/$($plan.id)/approve" @{comment="Smoke approve plan"} $teacherHeaders
$plan=Call "PATCH" "/teacher/course-plans/$($plan.id)" @{title="Lộ trình smoke Python - revision";teacherEditingSeconds=15} $teacherHeaders
if($plan.status-ne"REVISION_REQUIRED"){throw "Editing an APPROVED plan must require review again"}
$plan=Call "POST" "/teacher/course-plans/$($plan.id)/submit-review" @{comment="Smoke resubmit plan"} $teacherHeaders
$plan=Call "POST" "/teacher/course-plans/$($plan.id)/approve" @{comment="Smoke reapprove plan"} $teacherHeaders
$plan=Call "POST" "/teacher/course-plans/$($plan.id)/publish" @{comment="Smoke publish plan"} $teacherHeaders
if($plan.status-ne"PUBLISHED"){throw "Course plan was not published"}

Write-Host "[OK] Supabase product flow: progress -> animation -> attempt -> AI recommendation -> lesson review -> course-plan revision/publish" -ForegroundColor Green
