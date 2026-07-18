from fastapi import APIRouter, Depends, Request

from app.schemas.personalization import AnalyzeEventRequest, AnalyzeEventResponse
from app.services.personalization import PersonalizationService

router = APIRouter(prefix="/v1/personalization", tags=["personalization"])


def get_service(request: Request) -> PersonalizationService:
    return request.app.state.personalization_service


@router.post("/analyze-event", response_model=AnalyzeEventResponse)
def analyze_event(
    payload: AnalyzeEventRequest,
    service: PersonalizationService = Depends(get_service),
) -> AnalyzeEventResponse:
    return service.analyze(payload)
