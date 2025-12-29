"""Google Cloud Speech-to-Text streaming service.

Provides real-time speech-to-text using Google Cloud Speech v2 API
with streaming recognition for low-latency transcription.
"""

import asyncio
from typing import AsyncIterator, Optional

from google.cloud.speech_v2 import SpeechAsyncClient
from google.cloud.speech_v2.types import cloud_speech

from app.config import get_settings

settings = get_settings()

# Regional client instance (Chirp model requires us-central1)
_speech_client: Optional[SpeechAsyncClient] = None
STT_LOCATION = "us-central1"


def get_speech_client() -> SpeechAsyncClient:
    """Get or create the Speech-to-Text async client for us-central1."""
    global _speech_client
    if _speech_client is None:
        # Chirp model is only available in specific regions, not global
        _speech_client = SpeechAsyncClient(
            client_options={"api_endpoint": f"{STT_LOCATION}-speech.googleapis.com"}
        )
        print(f"[STT] Initialized Google Cloud Speech-to-Text client (region: {STT_LOCATION})")
    return _speech_client


class SpeechToTextSession:
    """Manages a streaming STT session with Google Cloud Speech-to-Text.

    This class handles the bidirectional streaming required for real-time
    transcription. Audio chunks are sent to Google, and transcript updates
    are yielded back as they become available.
    """

    def __init__(
        self,
        language_code: str = "en-US",
        sample_rate_hertz: int = 16000,
        enable_interim_results: bool = True,
    ):
        """Initialize a new STT session.

        Args:
            language_code: BCP-47 language code (e.g., "en-US")
            sample_rate_hertz: Audio sample rate (must match client audio)
            enable_interim_results: Whether to return partial transcripts
        """
        self.language_code = language_code
        self.sample_rate_hertz = sample_rate_hertz
        self.enable_interim_results = enable_interim_results
        self._is_active = False
        self._audio_queue: asyncio.Queue[Optional[bytes]] = asyncio.Queue()
        self._recognizer_path = f"projects/{settings.gcp_project_id}/locations/{STT_LOCATION}/recognizers/_"

    async def _audio_generator(self) -> AsyncIterator[cloud_speech.StreamingRecognizeRequest]:
        """Generate streaming requests from queued audio chunks."""
        # First request must contain the streaming config
        config = cloud_speech.StreamingRecognitionConfig(
            config=cloud_speech.RecognitionConfig(
                explicit_decoding_config=cloud_speech.ExplicitDecodingConfig(
                    encoding=cloud_speech.ExplicitDecodingConfig.AudioEncoding.LINEAR16,
                    sample_rate_hertz=self.sample_rate_hertz,
                    audio_channel_count=1,
                ),
                language_codes=[self.language_code],
                model="chirp",  # Latest high-quality model
                features=cloud_speech.RecognitionFeatures(
                    enable_automatic_punctuation=True,
                ),
            ),
            streaming_features=cloud_speech.StreamingRecognitionFeatures(
                interim_results=self.enable_interim_results,
            ),
        )

        yield cloud_speech.StreamingRecognizeRequest(
            recognizer=self._recognizer_path,
            streaming_config=config,
        )

        # Subsequent requests contain audio data
        while True:
            chunk = await self._audio_queue.get()
            if chunk is None:
                # None signals end of audio stream
                break
            yield cloud_speech.StreamingRecognizeRequest(audio=chunk)

    async def process_audio_stream(self) -> AsyncIterator[dict]:
        """Process audio from queue and yield transcript updates.

        Yields:
            Dict with keys:
                - text: The transcribed text
                - is_final: Whether this is a final transcript
        """
        client = get_speech_client()
        self._is_active = True

        try:
            responses = await client.streaming_recognize(
                requests=self._audio_generator()
            )

            async for response in responses:
                for result in response.results:
                    if result.alternatives:
                        transcript = result.alternatives[0].transcript
                        is_final = result.is_final

                        yield {
                            "text": transcript,
                            "is_final": is_final,
                        }

                        if is_final:
                            print(f"[STT] Final: {transcript}")

        except Exception as e:
            print(f"[STT] Error during streaming: {e}")
            raise
        finally:
            self._is_active = False

    async def add_audio(self, audio_data: bytes) -> None:
        """Add audio chunk to the processing queue.

        Args:
            audio_data: Raw PCM audio bytes (LINEAR16, 16kHz, mono)
        """
        if self._is_active:
            await self._audio_queue.put(audio_data)

    async def stop(self) -> None:
        """Signal end of audio stream."""
        await self._audio_queue.put(None)
        self._is_active = False

    @property
    def is_active(self) -> bool:
        """Check if the session is currently processing audio."""
        return self._is_active
