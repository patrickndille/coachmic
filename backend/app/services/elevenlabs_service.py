"""ElevenLabs Conversational AI and TTS service."""

from typing import AsyncIterator
import httpx

from app.config import get_settings

settings = get_settings()

# Default coach voice - Rachel (warm, professional female voice)
DEFAULT_COACH_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel voice


async def text_to_speech_stream(
    text: str,
    voice_id: str = DEFAULT_COACH_VOICE_ID,
    model_id: str = "eleven_turbo_v2_5",
) -> AsyncIterator[bytes]:
    """
    Convert text to speech using ElevenLabs TTS API with streaming.

    Args:
        text: The text to convert to speech
        voice_id: ElevenLabs voice ID (default: Rachel)
        model_id: TTS model to use (default: turbo for low latency)

    Yields:
        Audio data chunks (mp3 format)
    """
    if not settings.elevenlabs_api_key:
        raise ValueError("ElevenLabs API key not configured")

    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream",
            headers={
                "xi-api-key": settings.elevenlabs_api_key,
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": model_id,
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                },
            },
            timeout=60.0,
        ) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes():
                yield chunk


async def text_to_speech(
    text: str,
    voice_id: str = DEFAULT_COACH_VOICE_ID,
    model_id: str = "eleven_turbo_v2_5",
) -> bytes:
    """
    Convert text to speech using ElevenLabs TTS API.

    Args:
        text: The text to convert to speech
        voice_id: ElevenLabs voice ID (default: Rachel)
        model_id: TTS model to use

    Returns:
        Audio data (mp3 format)
    """
    chunks = []
    async for chunk in text_to_speech_stream(text, voice_id, model_id):
        chunks.append(chunk)
    return b"".join(chunks)


async def get_signed_url(agent_id: str, session_context: dict, user_id: str | None = None) -> str:
    """
    Get a signed URL for ElevenLabs Conversational AI session.

    The signed URL allows the frontend to establish a WebSocket connection
    with the ElevenLabs agent for voice conversation.

    Uses user's ElevenLabs credentials if available, otherwise falls back to system defaults.

    Args:
        agent_id: The ElevenLabs agent ID (system default)
        session_context: Context to customize the conversation (role, company, etc.)
        user_id: Firebase user ID (optional, for user-specific credentials)

    Returns:
        Signed URL string for WebSocket connection
    """
    # Import here to avoid circular dependency
    from app.services.user_credentials_service import get_elevenlabs_credentials_for_user

    # Get credentials (user's or system default)
    api_key, resolved_agent_id = await get_elevenlabs_credentials_for_user(
        uid=user_id,
        default_api_key=settings.elevenlabs_api_key,
        default_agent_id=agent_id or settings.elevenlabs_agent_id,
        kms_key_name=settings.kms_key_name,
    )

    if not api_key:
        raise ValueError("ElevenLabs API key not configured")

    if not resolved_agent_id:
        raise ValueError("ElevenLabs agent ID not configured")

    # Build dynamic prompt overrides based on session context (not used for signed URL)
    # Overrides are now passed from frontend to ElevenLabs directly
    _ = build_prompt_overrides(session_context)  # Keep for logging/debugging

    async with httpx.AsyncClient() as client:
        # Get the signed URL using GET request
        response = await client.get(
            "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url",
            params={"agent_id": resolved_agent_id},
            headers={
                "xi-api-key": api_key,
            },
            timeout=30.0,
        )

        response.raise_for_status()
        data = response.json()

        return data["signed_url"]


def build_coach_prompt_overrides(context: dict) -> dict:
    """Build coaching conversation configuration overrides.

    Supports the Unified Interview Coach with:
    - Auto-detected phase (pre/post interview)
    - Cross-phase context injection (pre-coaching summary into post-coaching)
    - No-resume fallback for generic coaching
    """
    coach_type = context.get("coach_type", "pre_interview")
    target_role = context.get("target_role", "General")
    target_company = context.get("target_company")
    resume_data = context.get("resume_data")
    feedback_data = context.get("feedback_data")
    pre_coaching_context = context.get("pre_coaching_context")  # NEW: Cross-phase context

    # Get candidate name
    candidate_name = "there"
    if resume_data and resume_data.get("name"):
        candidate_name = resume_data["name"].split()[0]  # First name only

    # Build system prompt based on coach type
    if coach_type == "post_interview":
        system_prompt_parts = [
            "You are an expert career coach helping a candidate improve after an interview practice session.",
            f"The candidate interviewed for a {target_role} position.",
            "",
            "YOUR ROLE:",
            "- Review their interview feedback with them",
            "- Help them understand their scores and what they mean",
            "- Work on improving specific answers using the STAR method",
            "- Create actionable improvement plans",
            "- Be encouraging but honest about areas needing work",
            "",
            "COACHING STYLE:",
            "- Warm, supportive, and professional",
            "- Use the Socratic method - ask questions to guide improvement",
            "- Give specific, actionable feedback",
            "- Celebrate progress and strengths",
            "- Keep responses conversational and concise (this is voice)",
        ]

        # Include resume data for personalized coaching
        if resume_data:
            system_prompt_parts.extend([
                "",
                "=== CANDIDATE BACKGROUND (from resume) ===",
            ])
            if resume_data.get("summary"):
                system_prompt_parts.append(f"Summary: {resume_data['summary']}")
            if resume_data.get("skills"):
                system_prompt_parts.append(f"Key Skills: {', '.join(resume_data['skills'][:10])}")
            if resume_data.get("experience"):
                system_prompt_parts.append("Work Experience:")
                for exp in resume_data["experience"][:3]:
                    title = exp.get("title", "")
                    company = exp.get("company", "")
                    if title and company:
                        system_prompt_parts.append(f"  - {title} at {company}")
            if resume_data.get("key_achievements"):
                system_prompt_parts.append(f"Key Achievements: {'; '.join(resume_data['key_achievements'][:3])}")
            system_prompt_parts.append("=== END BACKGROUND ===")
            system_prompt_parts.append("")
            system_prompt_parts.append("IMPORTANT: Use the candidate's resume background above to give personalized improvement advice. Reference their actual experience and skills when suggesting how to improve answers.")

        if feedback_data:
            system_prompt_parts.extend([
                "",
                "=== INTERVIEW FEEDBACK ===",
                f"Overall Score: {feedback_data.get('overallScore', 'N/A')}/100",
            ])
            category_scores = feedback_data.get("categoryScores", {})
            if category_scores:
                system_prompt_parts.append(f"Content: {category_scores.get('content', 'N/A')}, Delivery: {category_scores.get('delivery', 'N/A')}, Structure: {category_scores.get('structure', 'N/A')}")

            strengths = feedback_data.get("strengths", [])
            if strengths:
                system_prompt_parts.append(f"Strengths: {', '.join(strengths[:3])}")

            improvements = feedback_data.get("areasForImprovement", [])
            if improvements:
                system_prompt_parts.append(f"Areas to Improve: {', '.join(improvements[:3])}")
            system_prompt_parts.append("=== END FEEDBACK ===")

        # Inject pre-coaching context for cross-phase continuity (Unified Coach feature)
        if pre_coaching_context:
            system_prompt_parts.extend([
                "",
                "=== PRE-INTERVIEW COACHING CONTEXT ===",
                "You previously coached this candidate BEFORE their interview. Here's what you discussed:",
                pre_coaching_context,
                "",
                "Use this context to provide more targeted improvement advice.",
                "Reference specific stories or areas you previously worked on together.",
                "=== END PRE-COACHING CONTEXT ===",
            ])
            print(f"[Voice] Injected pre-coaching context into post-interview prompt")

        # Build personalized first message
        if resume_data and feedback_data:
            first_message = f"Hi {candidate_name}! Great job completing your interview practice. I've reviewed both your resume and your interview feedback, so I can give you personalized advice. Your overall score was {feedback_data.get('overallScore', 'N/A')}/100, and I can see some clear strengths as well as areas where we can work together. Would you like to start by understanding your scores, or jump straight into improving a specific answer using examples from your experience?"
        elif feedback_data:
            first_message = f"Hi {candidate_name}! Great job completing your interview practice. I've reviewed your feedback and I'm here to help you improve. Your overall score was {feedback_data.get('overallScore', 'N/A')}/100. Would you like to start by understanding your scores, or jump straight into improving a specific answer?"
        else:
            first_message = f"Hi {candidate_name}! Great job completing your interview practice. I'm here to help you improve your interview skills. Would you like to discuss what went well or focus on areas to improve?"

    else:  # pre_interview
        system_prompt_parts = [
            "You are an expert career coach helping a candidate prepare for an upcoming interview.",
            f"The candidate is preparing for a {target_role} position",
        ]

        if target_company:
            system_prompt_parts.append(f"at {target_company}.")
        else:
            system_prompt_parts.append(".")

        system_prompt_parts.extend([
            "",
            "YOUR ROLE:",
            "- Help them refine their STAR stories from their resume",
            "- Practice common interview questions",
            "- Build confidence through positive reinforcement",
            "- Provide tips specific to the role and company",
            "- Help them articulate their unique value proposition",
            "",
            "COACHING STYLE:",
            "- Warm, encouraging, and professional",
            "- Use the Socratic method - ask questions to guide improvement",
            "- Give specific, actionable feedback",
            "- Keep responses conversational and concise (this is voice)",
        ])

        if resume_data:
            system_prompt_parts.extend([
                "",
                "=== CANDIDATE BACKGROUND ===",
            ])
            if resume_data.get("summary"):
                system_prompt_parts.append(f"Summary: {resume_data['summary']}")
            if resume_data.get("skills"):
                system_prompt_parts.append(f"Key Skills: {', '.join(resume_data['skills'][:10])}")
            if resume_data.get("key_achievements"):
                system_prompt_parts.append(f"Key Achievements: {'; '.join(resume_data['key_achievements'][:3])}")
            system_prompt_parts.append("=== END BACKGROUND ===")

        first_message = f"Hi {candidate_name}! I'm excited to help you prepare for your {target_role} interview{' at ' + target_company if target_company else ''}. I've reviewed your background and I can help you craft compelling stories and practice your responses. What would you like to focus on first - refining your elevator pitch, practicing common questions, or working on specific STAR stories?"

    system_prompt = "\n".join(system_prompt_parts)

    return {
        "system_prompt": system_prompt,
        "first_message": first_message,
    }


def build_prompt_overrides(context: dict) -> dict:
    """Build conversation configuration overrides based on session context."""
    target_role = context.get("target_role", "General")
    target_company = context.get("target_company")
    interview_type = context.get("interview_type", "behavioral")
    interview_length = context.get("interview_length", "short")  # short, medium, long
    difficulty_level = context.get("difficulty_level", "easy")  # easy, medium, hard
    resume_data = context.get("resume_data")
    job_data = context.get("job_data")  # Full job posting data for realistic questions

    # Determine question count based on interview length
    length_config = {
        "short": {"min_questions": 5, "max_questions": 7, "duration": "10 minutes"},
        "medium": {"min_questions": 10, "max_questions": 12, "duration": "20 minutes"},
        "long": {"min_questions": 15, "max_questions": 20, "duration": "30 minutes"},
    }
    config = length_config.get(interview_length, length_config["short"])
    min_q = config["min_questions"]
    max_q = config["max_questions"]
    duration = config["duration"]

    # Determine difficulty description
    difficulty_desc = {
        "easy": "entry-level, focusing on fundamental concepts and basic behavioral scenarios",
        "medium": "mid-level, with moderate complexity and some challenging follow-ups",
        "hard": "senior-level, with complex scenarios, deep technical probes, and challenging situational questions",
    }
    difficulty_text = difficulty_desc.get(difficulty_level, difficulty_desc["easy"])

    # Debug logging
    print(f"[PromptBuilder] Building prompt for role: {target_role}")
    print(f"[PromptBuilder] Interview length: {interview_length} ({min_q}-{max_q} questions, {duration})")
    print(f"[PromptBuilder] Difficulty: {difficulty_level}")
    print(f"[PromptBuilder] Resume data present: {resume_data is not None}")
    print(f"[PromptBuilder] Job data present: {job_data is not None}")
    if resume_data:
        print(f"[PromptBuilder] Resume name: {resume_data.get('name')}")
        print(f"[PromptBuilder] Resume skills: {resume_data.get('skills', [])[:5]}")
        print(f"[PromptBuilder] Resume experience count: {len(resume_data.get('experience', []))}")
    if job_data:
        print(f"[PromptBuilder] Job title: {job_data.get('title')}")
        print(f"[PromptBuilder] Job company: {job_data.get('company')}")

    # Build dynamic system prompt
    system_prompt_parts = [
        f"You are an expert interviewer conducting a {interview_type} interview.",
        f"The candidate is interviewing for a {target_role} position.",
    ]

    if target_company:
        system_prompt_parts.append(
            f"The interview is for {target_company}. Tailor questions to their known culture and values."
        )

    if resume_data:
        # Add comprehensive resume context for personalized questions
        system_prompt_parts.append("\n=== CANDIDATE RESUME INFORMATION ===")

        if resume_data.get("name"):
            system_prompt_parts.append(f"Candidate Name: {resume_data['name']}")

        if resume_data.get("email"):
            system_prompt_parts.append(f"Email: {resume_data['email']}")

        if resume_data.get("summary"):
            system_prompt_parts.append(f"\nProfessional Summary: {resume_data['summary']}")

        if resume_data.get("skills"):
            skills = ", ".join(resume_data["skills"][:15])
            system_prompt_parts.append(f"\nSkills: {skills}")

        # Note: Backend uses "experience" (singular), not "experiences"
        if resume_data.get("experience"):
            system_prompt_parts.append("\nWork Experience:")
            for exp in resume_data["experience"][:5]:
                title = exp.get("title", "")
                company = exp.get("company", "")
                if title and company:
                    system_prompt_parts.append(f"- {title} at {company}")

        # Education section - Gemini now provides institution, field, and degree
        if resume_data.get("education"):
            system_prompt_parts.append("\nEducation:")
            for edu in resume_data["education"][:3]:
                degree = edu.get("degree", "")
                field = edu.get("field", "")
                institution = edu.get("institution", "")
                if degree:
                    edu_str = f"- {degree}"
                    if field:
                        edu_str += f" in {field}"
                    if institution:
                        edu_str += f" from {institution}"
                    system_prompt_parts.append(edu_str)

        system_prompt_parts.append("\n=== END RESUME ===")
        system_prompt_parts.append("\nIMPORTANT: Use the resume information above to ask personalized questions. Reference their ACTUAL companies, job titles, and skills. Do NOT make up information. Ask about their real experiences listed above.")

    # Add job posting data for realistic, job-specific questions
    if job_data:
        system_prompt_parts.append("\n=== JOB POSTING INFORMATION ===")
        system_prompt_parts.append(f"Job Title: {job_data.get('title', 'N/A')}")
        system_prompt_parts.append(f"Company: {job_data.get('company', 'N/A')}")
        if job_data.get('location'):
            system_prompt_parts.append(f"Location: {job_data['location']}")
        if job_data.get('description'):
            # Truncate long descriptions
            desc = job_data['description']
            if len(desc) > 1000:
                desc = desc[:1000] + "..."
            system_prompt_parts.append(f"\nJob Description: {desc}")
        if job_data.get('requirements'):
            reqs = job_data['requirements'][:10]  # Limit to 10 requirements
            system_prompt_parts.append("\nRequired Qualifications:")
            for req in reqs:
                system_prompt_parts.append(f"  - {req}")
        if job_data.get('niceToHave'):
            nice = job_data['niceToHave'][:5]  # Limit to 5
            system_prompt_parts.append("\nPreferred Qualifications:")
            for item in nice:
                system_prompt_parts.append(f"  - {item}")
        system_prompt_parts.append("\n=== END JOB POSTING ===")
        system_prompt_parts.append("\nIMPORTANT: Use the job posting information above to ask role-specific questions. Probe how the candidate's experience aligns with the stated requirements. Ask about their experience with specific technologies or skills mentioned in the job description.")

    # Interview type specific instructions
    if interview_type == "behavioral":
        system_prompt_parts.extend([
            "\nFocus on behavioral questions using the STAR method.",
            "Ask about past situations, actions taken, and results achieved.",
            "Probe deeper with follow-up questions when answers lack specificity.",
        ])
    elif interview_type == "technical":
        system_prompt_parts.extend([
            "\nFocus on technical questions relevant to the role.",
            "Ask about problem-solving approaches and technical decisions.",
            "Evaluate depth of knowledge while being conversational.",
        ])
    else:  # mixed
        system_prompt_parts.extend([
            "\nMix behavioral and technical questions.",
            "Start with behavioral questions, then move to technical topics.",
            "Maintain a natural conversation flow.",
        ])

    # Add interview length and difficulty instructions
    system_prompt_parts.extend([
        f"\n=== INTERVIEW CONFIGURATION ===",
        f"Duration: This is a {interview_length} interview lasting approximately {duration}.",
        f"Question Count: Ask exactly {min_q} to {max_q} questions total (including the opening 'tell me about yourself').",
        f"Difficulty: Questions should be {difficulty_text}.",
        f"\nCRITICAL INSTRUCTIONS:",
        f"1. Count your questions carefully. You MUST end the interview after asking {max_q} questions maximum.",
        f"2. After your final question and the candidate's response, conclude with: 'Thank you for your time today. That concludes our interview. You've shared some great insights about your experience. Best of luck!'",
        f"3. Do NOT ask any more questions after saying the closing statement.",
        f"4. Be professional but warm. Acknowledge good answers.",
        f"5. Keep responses concise - this is a voice conversation.",
    ])

    system_prompt = "\n".join(system_prompt_parts)

    # Build first message with resume context
    if resume_data and resume_data.get("name"):
        first_message = f"Hello {resume_data['name']}! Thanks for joining me today. I've reviewed your resume and I'm excited to learn more about your background. Let's start with a question: Can you tell me about yourself and what drew you to this {target_role} position?"
    else:
        first_message = f"Hello! Thanks for joining me today. I'm excited to learn more about your background and how you might fit the {target_role} role. Let's start with a question: Can you tell me about yourself and what drew you to this position?"

    # Return configuration overrides with metadata
    return {
        "system_prompt": system_prompt,
        "first_message": first_message,
        "interview_config": {
            "min_questions": min_q,
            "max_questions": max_q,
            "duration": duration,
            "difficulty": difficulty_level,
        }
    }


def build_conversation_summary(transcript: list, max_entries: int = 10) -> str:
    """Build a concise summary of the conversation for context injection.

    Args:
        transcript: List of transcript entries [{speaker, text, timestamp, id}]
        max_entries: Maximum number of recent entries to include

    Returns:
        Formatted conversation summary string
    """
    if not transcript:
        return "No previous conversation."

    # Get last N entries for context (most recent = most relevant)
    recent = transcript[-max_entries:] if len(transcript) > max_entries else transcript

    summary_lines = []
    for entry in recent:
        speaker = "Interviewer" if entry.get('speaker') == 'agent' else "Candidate"
        text = entry.get('text', '')
        # Truncate long texts to keep context manageable
        if len(text) > 200:
            text = text[:200] + "..."
        summary_lines.append(f"{speaker}: {text}")

    return "\n".join(summary_lines)


def get_last_agent_message(transcript: list) -> str:
    """Get the last message from the agent (interviewer).

    Args:
        transcript: List of transcript entries

    Returns:
        The text of the last agent message, or empty string if none
    """
    if not transcript:
        return ""

    # Iterate backwards to find the last agent message
    for entry in reversed(transcript):
        if entry.get('speaker') == 'agent':
            return entry.get('text', '')

    return ""


def generate_resume_first_message(last_agent_message: str, questions_asked: int) -> str:
    """Generate a natural continuation message for resuming.

    Args:
        last_agent_message: The last message from the interviewer
        questions_asked: Number of questions already asked

    Returns:
        A natural first message for the resumed session
    """
    if '?' in last_agent_message:
        # Last message was a question - let them answer
        return "Welcome back! I believe I just asked you a question. Please go ahead with your response when you're ready."
    elif questions_asked > 0:
        # Last message was a statement - move forward
        return f"Welcome back! Let's continue where we left off. We've covered {questions_asked} questions so far. Ready to continue?"
    else:
        # No questions yet - restart naturally
        return "Welcome back! Let's pick up where we left off. Ready to continue with the interview?"


def build_resume_prompt_overrides(
    session_context: dict,
    conversation_summary: str,
    last_agent_message: str,
    questions_asked: int,
) -> dict:
    """Build prompt overrides for resuming an interrupted interview.

    This injects the conversation history into the system prompt so the
    ElevenLabs agent has context about what happened before and can
    continue naturally without re-welcoming the candidate.

    Args:
        session_context: The session context (role, company, resume, etc.)
        conversation_summary: Formatted summary of previous conversation
        last_agent_message: The last message from the interviewer
        questions_asked: Number of questions already asked

    Returns:
        Dict with system_prompt and first_message for resume
    """
    # Get the base prompt (includes all interview config)
    base_prompt = build_prompt_overrides(session_context)

    # Build resume context to inject
    resume_context = f"""
## INTERVIEW RESUME CONTEXT
This is a RESUMED interview session. The candidate was disconnected or paused.
You have already asked {questions_asked} questions.

### Previous Conversation (last 10 exchanges):
{conversation_summary}

### Your Last Message Was:
"{last_agent_message}"

### CRITICAL INSTRUCTIONS FOR RESUME:
1. Do NOT welcome the candidate again - they have already been welcomed
2. Do NOT re-introduce yourself or the interview format
3. Continue naturally from where you left off
4. If your last message was a question, wait for their answer first
5. If they already answered your last question, acknowledge briefly and move to the next question
6. Maintain the same professional tone and pacing as before
7. Remember: You have asked {questions_asked} questions, adjust your remaining count accordingly
8. Do NOT repeat questions you've already asked - check the conversation history above
"""

    # Append resume context to the system prompt
    system_prompt = base_prompt["system_prompt"] + "\n\n" + resume_context

    # Generate appropriate first message for resume
    first_message = generate_resume_first_message(last_agent_message, questions_asked)

    print(f"[PromptBuilder] Building RESUME prompt")
    print(f"[PromptBuilder] Questions asked so far: {questions_asked}")
    print(f"[PromptBuilder] Last agent message: {last_agent_message[:50]}..." if last_agent_message else "[PromptBuilder] No previous agent message")

    return {
        "system_prompt": system_prompt,
        "first_message": first_message,
    }
