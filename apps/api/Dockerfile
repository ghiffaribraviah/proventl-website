FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
COPY apps/api/src ./apps/api/src
COPY apps/api/tests ./apps/api/tests

RUN uv sync --locked --dev

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "proventl_api.app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
