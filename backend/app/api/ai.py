from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.ai import AITextResponse, ImproveRequest, SuggestRequest, SummarizeRequest
from app.services.openai_service import openai_service


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/suggest")
async def suggest(payload: SuggestRequest, _: User = Depends(get_current_user)) -> StreamingResponse:
    async def event_stream():
        async for token in openai_service.stream_suggestion(
            text=payload.text,
            instruction=payload.instruction,
            document_title=payload.document_title,
            surrounding_text=payload.surrounding_text,
        ):
            yield token

    return StreamingResponse(event_stream(), media_type="text/plain")


@router.post("/summarize", response_model=AITextResponse)
async def summarize(payload: SummarizeRequest, _: User = Depends(get_current_user)) -> AITextResponse:
    text = await openai_service.complete_text("Summarize this document in a concise, useful way.", payload.text)
    return AITextResponse(text=text)


@router.post("/improve", response_model=AITextResponse)
async def improve(payload: ImproveRequest, _: User = Depends(get_current_user)) -> AITextResponse:
    text = await openai_service.complete_text(f"Improve this writing. Tone: {payload.tone}.", payload.text)
    return AITextResponse(text=text)

