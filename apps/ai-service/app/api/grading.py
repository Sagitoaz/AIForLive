from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.schemas.grading import IdeaGradingRequest, IdeaGradingResponse
from app.services.idea_grading import (
    GradingProviderUnavailable,
    IdeaGradingService,
    InvalidGradingProviderResponse,
)

router = APIRouter(prefix="/v1/grading", tags=["formative-grading"])


def get_service(request: Request) -> IdeaGradingService:
    return request.app.state.idea_grading_service


@router.post("/evaluate-idea", response_model=IdeaGradingResponse)
def evaluate_idea(
    payload: IdeaGradingRequest,
    service: IdeaGradingService = Depends(get_service),
) -> IdeaGradingResponse:
    try:
        return service.evaluate(payload)
    except GradingProviderUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except InvalidGradingProviderResponse as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error
