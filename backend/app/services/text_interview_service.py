"""Text Interview Service - Core logic for text-based mock interviews.

This service provides the same interview experience as the ElevenLabs voice
interview, but through a text chat interface using Google Gemini.

Key features:
- Reuses the same interview prompts as voice interviews (build_prompt_overrides)
- Same transcript format for feedback generation compatibility
- Real-time metrics tracking (filler words, word count)
- Pause/Resume capability with full context
"""

import random
import re
import uuid
from datetime import datetime
from typing import Optional

from app.models.text_interview import (
    InterviewConfig,
    InterviewMetrics,
    TextInterviewMessage,
    TextInterviewState,
)
from app.services.elevenlabs_service import (
    build_prompt_overrides,
    build_conversation_summary,
)
from app.services.gemini_service import generate_with_gemini
from app.services.firebase_service import get_firestore_client


# Firestore collection name
TEXT_INTERVIEW_COLLECTION = "text_interviews"

# Phrases that indicate the interviewer is closing
CLOSING_PHRASES = [
    "that concludes our interview",
    "concludes our interview",
    "thank you for your time today",
    "best of luck",
    "that's all the questions i have",
    "that's all the questions",
    "end of our interview",
    "interview is complete",
    "we've covered all",
]

# Common filler words to detect
FILLER_WORDS = [
    "um", "uh", "like", "you know", "so", "actually", "basically",
    "literally", "i mean", "kind of", "sort of", "really",
]


def _count_filler_words(text: str) -> tuple[int, list[str]]:
    """Count filler words in text and return count + list of detected fillers."""
    text_lower = text.lower()
    detected = []
    total_count = 0

    for filler in FILLER_WORDS:
        pattern = rf"\b{re.escape(filler)}\b"
        matches = re.findall(pattern, text_lower)
        count = len(matches)
        if count > 0:
            total_count += count
            detected.append(filler)

    return total_count, detected


def _calculate_metrics(
    user_message: str,
    current_metrics: InterviewMetrics
) -> InterviewMetrics:
    """Calculate updated metrics from a user message."""
    # Count words
    words = len(user_message.split())

    # Count filler words
    filler_count, filler_list = _count_filler_words(user_message)

    # Update existing filler words list (unique)
    existing_fillers = set(current_metrics.filler_words_detected)
    existing_fillers.update(filler_list)

    return InterviewMetrics(
        filler_word_count=current_metrics.filler_word_count + filler_count,
        total_words_spoken=current_metrics.total_words_spoken + words,
        total_speaking_time=current_metrics.total_speaking_time,  # Updated by elapsed_time
        filler_words_detected=list(existing_fillers),
    )


def _is_closing_statement(text: str) -> bool:
    """Check if the text contains a closing statement."""
    text_lower = text.lower()
    return any(phrase in text_lower for phrase in CLOSING_PHRASES)


def _build_conversation_context(messages: list[TextInterviewMessage], max_messages: int = 20) -> str:
    """Build conversation context string from messages."""
    recent = messages[-max_messages:] if len(messages) > max_messages else messages

    lines = []
    for msg in recent:
        role = "Interviewer" if msg.role == "interviewer" else "Candidate"
        # Truncate very long messages
        content = msg.content
        if len(content) > 500:
            content = content[:500] + "..."
        lines.append(f"{role}: {content}")

    return "\n".join(lines)


async def start_text_interview(
    session_id: str,
    user_id: str,
    context: dict,
) -> TextInterviewState:
    """Start a new text interview session.

    Args:
        session_id: The main session ID
        user_id: Firebase user ID
        context: Session context containing resume, role, company, settings

    Returns:
        Initial TextInterviewState with first message
    """
    # Reuse the exact same prompt logic as ElevenLabs voice interview
    prompt_overrides = build_prompt_overrides(context)
    system_prompt = prompt_overrides["system_prompt"]
    first_message = prompt_overrides["first_message"]
    interview_config_dict = prompt_overrides["interview_config"]

    # Add text-specific instructions to the system prompt
    text_instructions = """

## TEXT INTERVIEW MODE INSTRUCTIONS
This is a TEXT-BASED interview. Adjust your communication style:
- Keep responses conversational but concise (2-4 sentences typical)
- Wait for the candidate's text response before asking the next question
- Use natural language - no need for verbal cues like "hmm" or "I see"
- If the candidate's response is brief, ask for more details
- If the response is comprehensive, acknowledge briefly before moving on
"""
    system_prompt = system_prompt + text_instructions

    # Create interview config
    interview_config = InterviewConfig(
        min_questions=interview_config_dict["min_questions"],
        max_questions=interview_config_dict["max_questions"],
        duration=interview_config_dict["duration"],
        difficulty=interview_config_dict["difficulty"],
        interview_type=context.get("interview_type", "behavioral"),
    )

    # Create first message
    first_msg = TextInterviewMessage(
        id=str(uuid.uuid4()),
        role="interviewer",
        content=first_message,
        timestamp=int(datetime.now().timestamp() * 1000),
    )

    # Create initial state
    now = datetime.now()
    state = TextInterviewState(
        session_id=session_id,
        user_id=user_id,
        status="active",
        system_prompt=system_prompt,
        interview_config=interview_config,
        messages=[first_msg],
        question_count=1,  # First message contains the first question
        elapsed_time=0,
        metrics=InterviewMetrics(),
        started_at=now,
        last_activity_at=now,
    )

    # Save to Firestore
    await save_interview_state(state)

    print(f"[TextInterview] Started interview for session {session_id}")
    print(f"[TextInterview] Config: {interview_config.min_questions}-{interview_config.max_questions} questions, {interview_config.difficulty} difficulty")

    return state


async def process_user_message(
    session_id: str,
    user_message: str,
    elapsed_time: Optional[int] = None,
) -> tuple[str, int, int, bool, InterviewMetrics]:
    """Process a user message and generate the interviewer's response.

    Args:
        session_id: The session ID
        user_message: The user's response text
        elapsed_time: Current elapsed time in seconds (optional)

    Returns:
        Tuple of (interviewer_response, question_count, max_questions, is_closing, metrics)
    """
    # Load current state
    state = await load_interview_state(session_id)
    if not state:
        raise ValueError(f"No active text interview found for session {session_id}")

    if state.status != "active":
        raise ValueError(f"Interview is not active (status: {state.status})")

    # Add user message
    user_msg = TextInterviewMessage(
        id=str(uuid.uuid4()),
        role="user",
        content=user_message,
        timestamp=int(datetime.now().timestamp() * 1000),
    )
    state.messages.append(user_msg)

    # Calculate updated metrics
    state.metrics = _calculate_metrics(user_message, state.metrics)

    # Update elapsed time if provided
    if elapsed_time is not None:
        state.elapsed_time = elapsed_time
        # Estimate speaking time based on word count (150 WPM average)
        state.metrics.total_speaking_time = int(state.metrics.total_words_spoken / 150 * 60)

    # Check if we should be closing the interview
    # We need to generate closing AFTER the user responds to the max question
    # question_count represents how many questions have been asked
    should_close = state.question_count >= state.interview_config.max_questions

    # Generate interviewer response
    if should_close:
        # Set is_closing BEFORE generating to ensure it's set even if generation fails
        is_closing = True
        try:
            response = await _generate_closing_statement(state)
        except Exception as e:
            print(f"[TextInterview] Error generating closing statement: {e}")
            # Use fallback closing message
            response = "Thank you for your time today. That concludes our interview. You've shared some great insights about your experience. Best of luck with your job search!"
    else:
        # Generate next question/response
        try:
            response = await _generate_interviewer_response(state)
        except Exception as e:
            print(f"[TextInterview] Error generating response: {e}")
            # Use fallback response with follow-up question
            response = "Thank you for sharing that. Can you tell me more about a specific challenge you faced in that situation?"

        is_closing = _is_closing_statement(response)

        # Update question count if response contains a new question
        if not is_closing and "?" in response:
            state.question_count += 1
            # Check if this was the last question - if so, next response will be closing
            if state.question_count >= state.interview_config.max_questions:
                print(f"[TextInterview] Asked final question ({state.question_count}/{state.interview_config.max_questions}). Next response will be closing.")

    # Add interviewer response
    interviewer_msg = TextInterviewMessage(
        id=str(uuid.uuid4()),
        role="interviewer",
        content=response,
        timestamp=int(datetime.now().timestamp() * 1000),
    )
    state.messages.append(interviewer_msg)

    # Update last activity
    state.last_activity_at = datetime.now()

    # Save state
    await save_interview_state(state)

    print(f"[TextInterview] Question {state.question_count}/{state.interview_config.max_questions}, closing={is_closing}")

    return (
        response,
        state.question_count,
        state.interview_config.max_questions,
        is_closing,
        state.metrics,
    )


async def _generate_interviewer_response(state: TextInterviewState) -> str:
    """Generate the interviewer's next response using Gemini."""
    # Build conversation context
    conversation = _build_conversation_context(state.messages)

    # Build question count reminder
    remaining = state.interview_config.max_questions - state.question_count
    if remaining <= 1:
        reminder = f"\n\n[IMPORTANT: You have asked {state.question_count} of {state.interview_config.max_questions} questions. This should be your FINAL question. After the candidate responds, deliver your closing statement.]"
    elif remaining <= 3:
        reminder = f"\n\n[Note: You have asked {state.question_count} of {state.interview_config.max_questions} questions. You have {remaining} questions remaining. Start wrapping up.]"
    else:
        reminder = f"\n\n[Note: You have asked {state.question_count} of {state.interview_config.max_questions} questions. {remaining} questions remaining.]"

    prompt = f"""Continue the interview based on this conversation:

{conversation}
{reminder}

You are the interviewer. The candidate just responded above.

YOUR RESPONSE MUST INCLUDE TWO PARTS:
1. A brief acknowledgment of their answer (1 sentence)
2. Your next interview question (REQUIRED - always end with a question mark)

Format: "[Brief acknowledgment]. [Next question]?"

If their answer was vague, ask a follow-up to probe deeper.
Keep total response to 2-4 sentences."""

    response = await generate_with_gemini(
        prompt=prompt,
        system_instruction=state.system_prompt,
        temperature=0.7,
        max_tokens=2500,  # Increased to prevent cutoff
        task="text_interview",
        log_context="text_interview_response",
    )

    response_text = str(response).strip()

    # Check if response was cut off mid-sentence (doesn't end with punctuation)
    last_char = response_text[-1] if response_text else ''
    if last_char not in '.?!':
        # Response was truncated - try to salvage by finding last complete sentence
        last_period = response_text.rfind('.')
        last_question = response_text.rfind('?')
        last_exclaim = response_text.rfind('!')
        last_complete = max(last_period, last_question, last_exclaim)

        if last_complete > 0:
            response_text = response_text[:last_complete + 1]
            print(f"[TextInterview] Trimmed incomplete sentence from response")
        else:
            # No complete sentence found - use generic response
            response_text = "That's a thoughtful response."
            print(f"[TextInterview] Response was incomplete, using fallback")

    # Ensure response contains a question - if not, add a follow-up
    if "?" not in response_text:
        follow_ups = [
            "Can you elaborate on that?",
            "Could you give me a specific example?",
            "How did that experience shape your approach?",
            "What was the outcome of that situation?",
            "What did you learn from that experience?",
        ]
        response_text = response_text + " " + random.choice(follow_ups)
        print(f"[TextInterview] Added follow-up question to response")

    return response_text


async def _generate_closing_statement(state: TextInterviewState) -> str:
    """Generate the closing statement for the interview."""
    conversation = _build_conversation_context(state.messages[-4:])  # Just last few exchanges

    prompt = f"""Based on this interview excerpt:

{conversation}

Generate a warm closing statement for the interview. Include:
1. Thank the candidate for their time
2. Briefly acknowledge something positive from their responses
3. Wish them well

Keep it to 2-3 sentences. Example:
"Thank you for your time today. That concludes our interview. You've shared some great insights about your experience. Best of luck with your job search!" """

    response = await generate_with_gemini(
        prompt=prompt,
        system_instruction=state.system_prompt,
        temperature=0.7,
        max_tokens=1000,
        task="text_interview",
        log_context="text_interview_closing",
    )

    # Ensure it contains a closing phrase for detection
    response_text = str(response).strip()
    if not _is_closing_statement(response_text):
        response_text = "Thank you for your time today. That concludes our interview. " + response_text

    return response_text


async def pause_interview(
    session_id: str,
    elapsed_time: int,
    metrics: Optional[InterviewMetrics] = None,
) -> None:
    """Pause an interview and save current state."""
    state = await load_interview_state(session_id)
    if not state:
        raise ValueError(f"No text interview found for session {session_id}")

    state.status = "paused"
    state.paused_at = datetime.now()
    state.elapsed_time = elapsed_time
    if metrics:
        state.metrics = metrics

    await save_interview_state(state)
    print(f"[TextInterview] Paused interview {session_id}")


async def resume_interview(session_id: str) -> Optional[TextInterviewState]:
    """Resume a paused interview.

    Returns the state if found and paused, None otherwise.
    """
    state = await load_interview_state(session_id)
    if not state:
        return None

    if state.status != "paused":
        return None

    # Generate resume message
    last_interviewer_msg = None
    for msg in reversed(state.messages):
        if msg.role == "interviewer":
            last_interviewer_msg = msg.content
            break

    # Add a resume message from interviewer
    if last_interviewer_msg and "?" in last_interviewer_msg:
        resume_msg = "Welcome back! Take your time to respond to my previous question."
    else:
        resume_msg = f"Welcome back! Let's continue where we left off. We're on question {state.question_count} of {state.interview_config.max_questions}. Ready to continue?"

    resume_message = TextInterviewMessage(
        id=str(uuid.uuid4()),
        role="interviewer",
        content=resume_msg,
        timestamp=int(datetime.now().timestamp() * 1000),
    )
    state.messages.append(resume_message)

    state.status = "active"
    state.paused_at = None
    state.last_activity_at = datetime.now()

    await save_interview_state(state)
    print(f"[TextInterview] Resumed interview {session_id}")

    return state


async def end_interview(session_id: str) -> None:
    """End the interview and mark as completed."""
    state = await load_interview_state(session_id)
    if not state:
        raise ValueError(f"No text interview found for session {session_id}")

    state.status = "completed"
    state.last_activity_at = datetime.now()

    await save_interview_state(state)
    print(f"[TextInterview] Ended interview {session_id}")


async def get_interview_state(session_id: str) -> Optional[TextInterviewState]:
    """Get the current interview state."""
    return await load_interview_state(session_id)


def format_transcript_for_feedback(messages: list[TextInterviewMessage]) -> list[dict]:
    """Format transcript in the same format as voice interviews for feedback generation.

    The feedback system expects:
    [{"id": "...", "speaker": "agent"|"user", "text": "...", "timestamp": int}]
    """
    transcript = []
    for msg in messages:
        transcript.append({
            "id": msg.id,
            "speaker": "agent" if msg.role == "interviewer" else "user",
            "text": msg.content,
            "timestamp": msg.timestamp,
        })
    return transcript


# Firestore operations

async def save_interview_state(state: TextInterviewState) -> None:
    """Save interview state to Firestore."""
    db = get_firestore_client()
    doc_ref = db.collection(TEXT_INTERVIEW_COLLECTION).document(state.session_id)

    # Convert to dict for storage
    data = state.model_dump()

    # Convert datetime objects to ISO strings
    if data.get("started_at"):
        data["started_at"] = data["started_at"].isoformat()
    if data.get("paused_at"):
        data["paused_at"] = data["paused_at"].isoformat()
    if data.get("last_activity_at"):
        data["last_activity_at"] = data["last_activity_at"].isoformat()

    doc_ref.set(data, merge=True)


async def load_interview_state(session_id: str) -> Optional[TextInterviewState]:
    """Load interview state from Firestore."""
    db = get_firestore_client()
    doc_ref = db.collection(TEXT_INTERVIEW_COLLECTION).document(session_id)
    doc = doc_ref.get()

    if not doc.exists:
        return None

    data = doc.to_dict()

    # Convert ISO strings back to datetime
    if data.get("started_at") and isinstance(data["started_at"], str):
        data["started_at"] = datetime.fromisoformat(data["started_at"])
    if data.get("paused_at") and isinstance(data["paused_at"], str):
        data["paused_at"] = datetime.fromisoformat(data["paused_at"])
    if data.get("last_activity_at") and isinstance(data["last_activity_at"], str):
        data["last_activity_at"] = datetime.fromisoformat(data["last_activity_at"])

    return TextInterviewState(**data)


async def delete_interview_state(session_id: str) -> None:
    """Delete interview state from Firestore."""
    db = get_firestore_client()
    doc_ref = db.collection(TEXT_INTERVIEW_COLLECTION).document(session_id)
    doc_ref.delete()
