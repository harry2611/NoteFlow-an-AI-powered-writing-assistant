from pydantic import BaseModel


class SuggestRequest(BaseModel):
    text: str = ""
    instruction: str
    document_title: str | None = None
    surrounding_text: str = ""


class SummarizeRequest(BaseModel):
    text: str


class ImproveRequest(BaseModel):
    text: str
    tone: str = "clear and concise"


class AITextResponse(BaseModel):
    text: str

