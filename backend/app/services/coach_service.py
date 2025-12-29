"""AI Coach service for pre and post interview coaching."""

import json
import re
from datetime import datetime
from typing import Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field
from google.cloud import firestore

from app.models.resume import ResumeData
from app.services.gemini_service import generate_with_gemini
from app.services.firebase_service import get_firestore_client, get_coaching_sessions_collection


# ============================================================================
# PHASE DETECTION
# ============================================================================


def detect_coaching_phase(session_id: str) -> Literal["pre_interview", "post_interview"]:
    """
    Automatically detect coaching phase based on available data.

    Logic:
    - If feedback exists AND status == 'completed' → POST_INTERVIEW
    - If only resume exists (no completed feedback) → PRE_INTERVIEW

    This enables the Unified Interview Coach - a single intelligent agent
    that knows the user's stage without manual selection.
    """
    db = get_firestore_client()

    # Check feedback collection for completed interview feedback
    try:
        feedback_doc = db.collection('feedback').document(session_id).get()

        if feedback_doc.exists:
            feedback_data = feedback_doc.to_dict()
            if feedback_data.get('status') == 'completed':
                print(f"[Coach] Phase detected: POST_INTERVIEW (feedback found)")
                return "post_interview"
    except Exception as e:
        print(f"[Coach] Error checking feedback for phase detection: {e}")

    print(f"[Coach] Phase detected: PRE_INTERVIEW (no completed feedback)")
    return "pre_interview"


def _get_pre_coaching_summary(session_id: str) -> Optional[str]:
    """
    Get summary of pre-coaching session for injection into post-coaching.

    This provides continuity when user transitions from pre → interview → post.
    The post-interview coach knows what was discussed during pre-coaching.
    """
    db = get_firestore_client()

    try:
        coaching_doc = db.collection('coaching_sessions').document(session_id).get()

        if not coaching_doc.exists:
            return None

        data = coaching_doc.to_dict()

        # Only get summary if this was a pre-interview coaching session
        if data.get('coach_type') != 'pre_interview':
            return None

        # Build summary from available data
        messages = data.get('messages', [])
        voice_transcript = data.get('voice_transcript', [])
        session_notes = data.get('session_notes', [])

        if not messages and not voice_transcript:
            return None

        summary_parts = []

        # Add session notes if available (most important)
        if session_notes:
            summary_parts.append("Key topics discussed in pre-interview coaching:")
            for note in session_notes[:5]:
                summary_parts.append(f"  - {note}")

        # Add last few text exchanges for context
        if messages:
            summary_parts.append("\nRecent pre-coaching discussion:")
            for msg in messages[-4:]:
                role = "Coach" if msg.get('role') == 'coach' else "Candidate"
                content = msg.get('content', '')[:150]
                if len(msg.get('content', '')) > 150:
                    content += "..."
                summary_parts.append(f"  {role}: {content}")

        # Add voice transcript summary if no text messages
        elif voice_transcript:
            summary_parts.append("\nRecent pre-coaching voice discussion:")
            for entry in voice_transcript[-4:]:
                speaker = "Coach" if entry.get('speaker') == 'coach' else "Candidate"
                text = entry.get('text', '')[:150]
                if len(entry.get('text', '')) > 150:
                    text += "..."
                summary_parts.append(f"  {speaker}: {text}")

        return "\n".join(summary_parts) if summary_parts else None

    except Exception as e:
        print(f"[Coach] Error getting pre-coaching summary: {e}")
        return None


# ============================================================================
# COACHING MODELS
# ============================================================================


class CoachMessage(BaseModel):
    """A message in the coaching conversation."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    role: Literal["coach", "user"] = "user"
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    suggestions: list[str] = Field(default_factory=list)


class VoiceTranscriptEntry(BaseModel):
    """A single voice transcript entry."""

    id: str
    speaker: Literal["coach", "user"]
    text: str
    timestamp: int  # Unix timestamp in milliseconds


class CoachingSession(BaseModel):
    """Active coaching session with unified text/voice support."""

    session_id: str
    coach_type: Literal["pre_interview", "post_interview"]
    target_role: Optional[str] = None
    target_company: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    user_id: Optional[str] = None
    context_summary: Optional[str] = None

    # Mode tracking
    mode: Literal["text", "voice", "mixed"] = "text"
    status: Optional[str] = None  # active, interrupted, completed

    # Text mode data
    messages: list[CoachMessage] = Field(default_factory=list)

    # Voice mode data
    voice_transcript: list[VoiceTranscriptEntry] = Field(default_factory=list)
    elapsedTime: int = 0

    # Unified session notes (aggregated from both modes)
    session_notes: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)
    voice_summary: Optional[str] = None

    # Timestamps
    lastActivityAt: Optional[str] = None
    ended_at: Optional[str] = None


class CoachResponse(BaseModel):
    """Response from the coach."""

    message: CoachMessage
    session_notes: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)


# ============================================================================
# JSON EXTRACTION HELPER
# ============================================================================


def _extract_coach_response(response: str) -> dict:
    """
    Extract coach response from Gemini output with multiple fallback strategies.

    This function NEVER returns raw JSON to be displayed to users. It always
    extracts readable text content.

    Args:
        response: Raw response from Gemini

    Returns:
        dict with coach_response, suggestions, session_notes, action_items
    """
    default_result = {
        "coach_response": "",
        "suggestions": [],
        "session_notes": [],
        "action_items": [],
    }

    if not response or not response.strip():
        default_result["coach_response"] = "I'm here to help. What would you like to discuss?"
        return default_result

    # FIRST: Always strip markdown code blocks before any other processing
    cleaned = response.strip()

    # Remove markdown code block wrapper (```json ... ``` or ``` ... ```)
    if cleaned.startswith("```"):
        # Find the end of the first line (which may have language specifier)
        first_newline = cleaned.find('\n')
        if first_newline > 0:
            cleaned = cleaned[first_newline + 1:]
        else:
            # No newline, just remove the ```
            cleaned = cleaned[3:]

    # Remove trailing code block marker
    if "```" in cleaned:
        cleaned = cleaned.split("```")[0]

    # Also handle case where response starts with 'json' on its own line
    if cleaned.strip().startswith("json\n"):
        cleaned = cleaned.strip()[5:]
    elif cleaned.strip().startswith("JSON\n"):
        cleaned = cleaned.strip()[5:]

    cleaned = cleaned.strip()

    # Strategy 1: Try to parse as complete JSON
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict) and "coach_response" in data:
            return {
                "coach_response": data.get("coach_response", ""),
                "suggestions": data.get("suggestions", []),
                "session_notes": data.get("session_notes", []),
                "action_items": data.get("action_items", []),
            }
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract coach_response using character-by-character parsing
    # This handles TRUNCATED JSON where the value doesn't have a closing quote
    aggressive_pattern = r'"coach_response"\s*:\s*"'
    match = re.search(aggressive_pattern, cleaned)
    if match:
        start_idx = match.end()
        content_chars = []
        i = start_idx
        while i < len(cleaned):
            if cleaned[i] == '\\' and i + 1 < len(cleaned):
                # Escaped character
                next_char = cleaned[i + 1]
                if next_char == '"':
                    content_chars.append('"')
                elif next_char == 'n':
                    content_chars.append('\n')
                elif next_char == 't':
                    content_chars.append('\t')
                elif next_char == '\\':
                    content_chars.append('\\')
                else:
                    content_chars.append(next_char)
                i += 2
            elif cleaned[i] == '"':
                # End of string (proper closing quote)
                break
            else:
                content_chars.append(cleaned[i])
                i += 1

        content = ''.join(content_chars).strip()

        # Clean up any trailing JSON artifacts from truncation
        # Remove trailing commas, newlines, partial JSON
        content = re.sub(r'[\n\r]+$', '', content)
        content = content.rstrip(',').rstrip()

        if content and len(content) > 5:
            # Try to extract suggestions if they exist
            suggestions = []
            suggestions_pattern = r'"suggestions"\s*:\s*\[(.*?)\]'
            suggestions_match = re.search(suggestions_pattern, cleaned, re.DOTALL)
            if suggestions_match:
                sugg_content = suggestions_match.group(1)
                sugg_items = re.findall(r'"([^"]*)"', sugg_content)
                suggestions = sugg_items[:3]

            return {
                "coach_response": content,
                "suggestions": suggestions,
                "session_notes": [],
                "action_items": [],
            }

    # Strategy 3: Try regex for complete coach_response value
    content_pattern = r'"coach_response"\s*:\s*"((?:[^"\\]|\\.)*)?"'
    content_match = re.search(content_pattern, cleaned, re.DOTALL)
    if content_match:
        content = content_match.group(1)
        if content:
            content = content.replace('\\"', '"')
            content = content.replace('\\n', '\n')
            content = content.replace('\\t', '\t')
            content = content.replace('\\\\', '\\')

            return {
                "coach_response": content,
                "suggestions": [],
                "session_notes": [],
                "action_items": [],
            }

    # Strategy 4: If it looks like JSON but we couldn't extract, give helpful response
    if cleaned.startswith('{') or cleaned.startswith('[') or '"coach_response"' in cleaned:
        default_result["coach_response"] = "I understand. Let me help you with that. Could you tell me more about what specific aspect you'd like to focus on?"
        return default_result

    # Strategy 5: Response is plain text - use it directly
    # But clean up any remaining JSON-like artifacts
    if not cleaned.startswith('{') and not cleaned.startswith('"'):
        default_result["coach_response"] = cleaned
        return default_result

    # Final fallback
    default_result["coach_response"] = "I'm here to help you prepare. What would you like to work on?"
    return default_result


# ============================================================================
# SYSTEM PROMPTS
# ============================================================================


PRE_INTERVIEW_SYSTEM_PROMPT = """You are an expert interview coach helping a candidate prepare for an upcoming interview.

CANDIDATE CONTEXT:
{resume_context}

TARGET ROLE: {target_role}
TARGET COMPANY: {target_company}

YOUR COACHING APPROACH:
1. Build confidence through positive reinforcement
2. Help refine STAR stories to be more impactful
3. Practice anticipated questions
4. Provide company-specific insights when relevant
5. Give specific, actionable feedback
6. Use Socratic method - ask questions to guide improvement

COACHING STYLE:
- Warm but professional
- Encouraging yet honest
- Focus on concrete improvements
- Celebrate progress

CONVERSATION HISTORY:
{conversation_history}

Respond to the candidate's message naturally. If they share a story or answer, provide:
1. Positive reinforcement on what's working
2. Specific suggestions for improvement
3. A follow-up question or prompt to continue refining

End your response with 2-3 suggested follow-up prompts the candidate might say next.

Format your response as JSON:
{{
    "coach_response": "Your coaching response here",
    "suggestions": ["Suggested response 1", "Suggested response 2"],
    "session_notes": ["Key point from this exchange"],
    "action_items": ["Any specific action items for the candidate"]
}}"""


POST_INTERVIEW_SYSTEM_PROMPT = """You are an expert interview coach helping a candidate learn from their recent interview.

CANDIDATE CONTEXT:
{resume_context}

TARGET ROLE: {target_role}
INTERVIEW FEEDBACK:
{feedback_context}

YOUR COACHING APPROACH:
1. Help the candidate understand their scores and feedback
2. Identify specific areas for improvement
3. Practice improved versions of weak answers
4. Create action plans for next time
5. Maintain encouragement while being constructive

COACHING STYLE:
- Supportive and constructive
- Focus on growth opportunities
- Specific and actionable advice
- Help them see feedback as learning

CONVERSATION HISTORY:
{conversation_history}

Respond to the candidate's message. Help them:
1. Understand what the feedback means
2. Develop concrete strategies for improvement
3. Practice better versions of their answers
4. Build confidence for future interviews

End your response with 2-3 suggested follow-up prompts the candidate might say next.
These should be things the USER would ask or say, like "Help me improve question 3" or "Walk me through my scores".

Format your response as JSON:
{{
    "coach_response": "Your coaching response here",
    "suggestions": ["What the user might say 1", "What the user might say 2"],
    "session_notes": ["Key point from this exchange"],
    "action_items": ["Any specific action items for the candidate"]
}}"""


# ============================================================================
# COACH SERVICE FUNCTIONS
# ============================================================================


def _build_resume_context(resume_data: Optional[ResumeData]) -> str:
    """Build a context summary from resume data."""
    if not resume_data:
        return """No resume uploaded.
Provide generic interview coaching advice without personalization.
Focus on STAR method fundamentals and general behavioral interview strategies.
Ask the candidate to describe their background verbally if needed."""

    parts = []

    if resume_data.name:
        parts.append(f"Name: {resume_data.name}")

    if resume_data.career_signals:
        cs = resume_data.career_signals
        if cs.seniority_level:
            parts.append(f"Level: {cs.seniority_level}")
        if cs.years_experience:
            parts.append(f"Experience: {cs.years_experience} years")

    if resume_data.skills:
        parts.append(f"Key Skills: {', '.join(resume_data.skills[:8])}")

    if resume_data.star_stories:
        stories = []
        for story in resume_data.star_stories[:3]:
            stories.append(f"- {story.theme}: {story.result[:100]}")
        parts.append(f"STAR Stories Available:\n" + "\n".join(stories))

    if resume_data.talking_points and resume_data.talking_points.key_strengths:
        parts.append(f"Key Strengths: {', '.join(resume_data.talking_points.key_strengths[:3])}")

    return "\n".join(parts) if parts else "Basic profile available."


def _build_conversation_history(messages: list[CoachMessage], max_messages: int = 10) -> str:
    """Build conversation history string."""
    if not messages:
        return "This is the start of the conversation."

    recent = messages[-max_messages:]
    lines = []
    for msg in recent:
        role = "Coach" if msg.role == "coach" else "Candidate"
        lines.append(f"{role}: {msg.content}")

    return "\n\n".join(lines)


def _build_feedback_context(feedback_data: Optional[dict]) -> str:
    """Build context from interview feedback."""
    if not feedback_data:
        return "No specific feedback available yet."

    parts = []

    if "overallScore" in feedback_data:
        parts.append(f"Overall Score: {feedback_data['overallScore']}/100")

    if "categoryScores" in feedback_data:
        cs = feedback_data["categoryScores"]
        parts.append(f"Content: {cs.get('content', 'N/A')}, Delivery: {cs.get('delivery', 'N/A')}, Structure: {cs.get('structure', 'N/A')}")

    if "strengths" in feedback_data:
        parts.append(f"Strengths: {', '.join(feedback_data['strengths'][:3])}")

    if "areasForImprovement" in feedback_data:
        parts.append(f"Areas to Improve: {', '.join(feedback_data['areasForImprovement'][:3])}")

    return "\n".join(parts) if parts else "Feedback being processed."


def _get_voice_transcript_context(session_id: str) -> Optional[str]:
    """Get voice transcript context for cross-mode memory in text sessions."""
    db = get_firestore_client()
    coaching_ref = db.collection("coaching_sessions").document(session_id)

    try:
        doc = coaching_ref.get()
        if not doc.exists:
            return None

        data = doc.to_dict()
        transcript = data.get("voice_transcript", [])
        if not transcript:
            return None

        # Build summary of voice conversation (last 5 entries)
        recent = transcript[-5:]
        lines = []
        for entry in recent:
            speaker = "Coach" if entry.get("speaker") == "coach" else "Candidate"
            text = entry.get("text", "")[:150]  # Truncate long messages
            lines.append(f"{speaker}: {text}")

        return "Previous voice coaching discussion:\n" + "\n".join(lines)
    except Exception as e:
        print(f"[Coach] Error getting voice transcript context: {e}")
        return None


async def start_coaching_session(
    session_id: str,
    coach_type: Literal["pre_interview", "post_interview"],
    user_id: str,
    target_role: Optional[str] = None,
    target_company: Optional[str] = None,
    resume_data: Optional[ResumeData] = None,
    feedback_data: Optional[dict] = None,
    pre_coaching_context: Optional[str] = None,  # NEW: Cross-phase context
) -> CoachingSession:
    """
    Start a new coaching session.

    Args:
        session_id: Main session ID
        coach_type: Type of coaching (pre or post interview)
        user_id: Firebase user ID for ownership tracking
        target_role: Role being interviewed for
        target_company: Company being interviewed at
        resume_data: Parsed resume data
        feedback_data: Interview feedback (for post-interview coaching)
        pre_coaching_context: Summary of pre-interview coaching for post-interview sessions

    Returns:
        New CoachingSession
    """
    # Check for cross-mode context from voice sessions
    voice_context = _get_voice_transcript_context(session_id)
    context_summary = _build_resume_context(resume_data)
    if voice_context:
        context_summary += f"\n\nPrevious Voice Session Context:\n{voice_context}"
        print(f"[Coach] Injected voice transcript context into text session")

    # Add pre-coaching context for post-interview sessions (cross-phase continuity)
    if pre_coaching_context and coach_type == "post_interview":
        context_summary += f"\n\nPre-Interview Coaching Context:\n{pre_coaching_context}"
        print(f"[Coach] Injected pre-coaching context into post-interview session")

    coaching_session = CoachingSession(
        session_id=session_id,
        coach_type=coach_type,
        target_role=target_role or "General",
        target_company=target_company,
        context_summary=context_summary,
        user_id=user_id,
        mode="text",  # Explicitly set mode for text coaching
        status="active",
    )

    # Generate initial greeting (with awareness of voice context)
    if coach_type == "pre_interview":
        greeting = await _generate_pre_interview_greeting(
            resume_data, target_role, target_company, has_voice_context=bool(voice_context)
        )
    else:
        greeting = await _generate_post_interview_greeting(
            resume_data, target_role, feedback_data, has_voice_context=bool(voice_context)
        )

    initial_message = CoachMessage(
        role="coach",
        content=greeting["message"],
        suggestions=greeting.get("suggestions", []),
    )
    coaching_session.messages.append(initial_message)

    # Store session in Firestore
    db = get_firestore_client()
    db.collection('coaching_sessions').document(session_id).set(
        coaching_session.model_dump(),
        merge=True  # Merge to preserve voice_transcript if it exists
    )

    return coaching_session


async def _generate_pre_interview_greeting(
    resume_data: Optional[ResumeData],
    target_role: Optional[str],
    target_company: Optional[str],
    has_voice_context: bool = False,
) -> dict:
    """Generate initial greeting for pre-interview coaching."""
    name = resume_data.name if resume_data and resume_data.name else "there"
    role = target_role or "your target role"
    company = f"at {target_company}" if target_company else ""

    # Check if we have STAR stories to work with
    has_stories = bool(resume_data and resume_data.star_stories)

    prompt = f"""Generate a warm, professional greeting for a pre-interview coaching session.

Candidate: {name}
Target Role: {role} {company}
Has STAR Stories: {has_stories}

Create a greeting that:
1. Welcomes them warmly by name
2. Acknowledges the role they're preparing for
3. Sets expectations for the coaching session
4. Asks an opening question to get started

Return JSON:
{{
    "message": "Your greeting here",
    "suggestions": ["Suggested response 1", "Suggested response 2", "Suggested response 3"]
}}"""

    response = await generate_with_gemini(
        prompt=prompt,
        temperature=0.7,
        max_tokens=1024,  # Increased for complete greeting
        task="resume_improve",
    )

    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        return json.loads(cleaned.strip())
    except json.JSONDecodeError:
        return {
            "message": f"Hi {name}! I'm excited to help you prepare for your {role} interview{' ' + company if company else ''}. Let's work together to make sure you're ready to showcase your best self. What aspect of the interview would you like to focus on first?",
            "suggestions": [
                "I want to practice my introduction",
                "Help me with behavioral questions",
                "Let's work on my STAR stories",
            ],
        }


async def _generate_post_interview_greeting(
    resume_data: Optional[ResumeData],
    target_role: Optional[str],
    feedback_data: Optional[dict],
    has_voice_context: bool = False,
) -> dict:
    """Generate initial greeting for post-interview coaching."""
    name = resume_data.name if resume_data and resume_data.name else "there"
    score = feedback_data.get("overallScore", "N/A") if feedback_data else "N/A"

    prompt = f"""Generate a supportive greeting for a post-interview coaching session.

Candidate: {name}
Role Interviewed For: {target_role or 'Unknown'}
Overall Score: {score}

Create a greeting that:
1. Congratulates them on completing the interview
2. Acknowledges their effort
3. Frames feedback as a learning opportunity
4. Offers to help them improve

Include 3 suggested follow-up prompts the candidate might say next.
These should be things the USER would ask or say, like "Walk me through my scores" or "Help me improve my weakest answer".

Return JSON:
{{
    "message": "Your greeting here",
    "suggestions": ["What user might say 1", "What user might say 2", "What user might say 3"]
}}"""

    response = await generate_with_gemini(
        prompt=prompt,
        temperature=0.7,
        max_tokens=1024,  # Increased for complete greeting
        task="resume_improve",
    )

    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        return json.loads(cleaned.strip())
    except json.JSONDecodeError:
        return {
            "message": f"Great job completing your interview, {name}! That takes real courage. Your overall score was {score}/100, which gives us great insights to work with. I'm here to help you understand the feedback and develop strategies for even stronger interviews. What would you like to explore first?",
            "suggestions": [
                "Walk me through my scores",
                "Help me improve my weakest answer",
                "Create an action plan for next time",
            ],
        }


async def process_coach_message(
    session_id: str,
    user_message: str,
    resume_data: Optional[ResumeData] = None,
    feedback_data: Optional[dict] = None,
) -> CoachResponse:
    """
    Process a user message and generate coach response.

    Args:
        session_id: Coaching session ID
        user_message: User's message
        resume_data: Optional resume data for context
        feedback_data: Optional feedback data for context

    Returns:
        CoachResponse with coach's message and metadata
    """
    # Load session from Firestore
    db = get_firestore_client()
    session_doc = db.collection('coaching_sessions').document(session_id).get()

    if not session_doc.exists:
        raise ValueError(f"Coaching session not found: {session_id}")

    session = CoachingSession(**session_doc.to_dict())

    # Add user message to history
    user_msg = CoachMessage(role="user", content=user_message)
    session.messages.append(user_msg)

    # Build context
    resume_context = _build_resume_context(resume_data) if resume_data else session.context_summary or "No resume data."
    conversation_history = _build_conversation_history(session.messages)

    # Choose prompt based on coach type
    if session.coach_type == "pre_interview":
        system_prompt = PRE_INTERVIEW_SYSTEM_PROMPT.format(
            resume_context=resume_context,
            target_role=session.target_role,
            target_company=session.target_company or "Not specified",
            conversation_history=conversation_history,
        )
    else:
        feedback_context = _build_feedback_context(feedback_data)
        system_prompt = POST_INTERVIEW_SYSTEM_PROMPT.format(
            resume_context=resume_context,
            target_role=session.target_role,
            feedback_context=feedback_context,
            conversation_history=conversation_history,
        )

    # Generate response
    prompt = f"Candidate says: {user_message}\n\nRespond as the coach."

    response = await generate_with_gemini(
        prompt=prompt,
        system_instruction=system_prompt,
        temperature=0.7,
        max_tokens=4028,  # Increased for detailed coaching responses in JSON format
        task="resume_improve",
    )

    # Parse response using robust extraction (never shows raw JSON to user)
    extracted = _extract_coach_response(response)

    coach_msg = CoachMessage(
        role="coach",
        content=extracted["coach_response"],
        suggestions=extracted["suggestions"],
    )
    session_notes = extracted["session_notes"]
    action_items = extracted["action_items"]

    # Add to history
    session.messages.append(coach_msg)

    # Update last activity timestamp
    session.lastActivityAt = datetime.utcnow().isoformat()

    # Save updated session to Firestore (merge to preserve voice_transcript if exists)
    db.collection('coaching_sessions').document(session_id).set(
        session.model_dump(),
        merge=True
    )

    return CoachResponse(
        message=coach_msg,
        session_notes=session_notes,
        action_items=action_items,
    )


def get_coaching_session(session_id: str) -> Optional[CoachingSession]:
    """Get an existing coaching session."""
    db = get_firestore_client()
    session_doc = db.collection('coaching_sessions').document(session_id).get()

    if not session_doc.exists:
        return None

    return CoachingSession(**session_doc.to_dict())


def end_coaching_session(session_id: str) -> Optional[dict]:
    """
    End a coaching session and return summary.

    Returns summary with all notes and action items.
    """
    # Load session from Firestore
    db = get_firestore_client()
    session_doc = db.collection('coaching_sessions').document(session_id).get()

    if not session_doc.exists:
        return None

    session_data = session_doc.to_dict()
    session = CoachingSession(**session_data)

    # Mark session as ended in Firestore (optional - could also delete)
    db.collection('coaching_sessions').document(session_id).update({
        'ended_at': datetime.utcnow().isoformat(),
        'status': 'completed',
    })

    # Compile all session notes from messages
    all_notes = []
    all_actions = []

    # The notes/actions were stored in responses, not tracked separately
    # For now, return basic summary
    return {
        "session_id": session_id,
        "coach_type": session.coach_type,
        "message_count": len(session.messages),
        "duration_minutes": 0,  # Would calculate from timestamps
        "summary": f"Coaching session completed with {len(session.messages)} messages.",
    }
