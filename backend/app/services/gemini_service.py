"""Google Gemini / Vertex AI service using the new google.genai SDK.

This module provides text generation capabilities using Google's Gemini models
via the unified google.genai SDK which supports both Vertex AI and API key auth.
"""

import os
import io
import json
import wave
import asyncio
import queue
import threading
import time
import base64
from datetime import datetime
from typing import Optional, Any, Literal, AsyncGenerator

from google import genai
from google.genai.types import GenerateContentConfig, HttpOptions

from app.config import get_settings

settings = get_settings()

# Configure environment based on available credentials
# Use API key (Google AI Studio) if available, otherwise fall back to Vertex AI
if settings.gcp_api_key:
    # Use Google AI Studio with API key (free tier available)
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"
    print("[Gemini] Using Google AI Studio with API key")
else:
    # Use Vertex AI (requires billing)
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
    if settings.gcp_project_id:
        os.environ["GOOGLE_CLOUD_PROJECT"] = settings.gcp_project_id
    if settings.gcp_location:
        os.environ["GOOGLE_CLOUD_LOCATION"] = settings.gcp_location
    print("[Gemini] Using Vertex AI")

# Global client instance
_client: genai.Client | None = None


def get_client() -> genai.Client:
    """Get or create the genai client."""
    global _client
    if _client is None:
        if settings.gcp_api_key:
            # Initialize with API key for Google AI Studio
            _client = genai.Client(
                api_key=settings.gcp_api_key,
                http_options=HttpOptions(api_version="v1")
            )
            print("[Gemini] Initialized google.genai client with API key")
        else:
            # Initialize for Vertex AI (uses ADC)
            _client = genai.Client(http_options=HttpOptions(api_version="v1"))
            print("[Gemini] Initialized google.genai client for Vertex AI")
    return _client


# Task type to model mapping
TaskType = Literal[
    "resume_parse",
    "resume_parse_basic",   # Split: basic extraction (name, skills, experience)
    "resume_parse_career",  # Split: career analysis (skill_graph, star_stories)
    "resume_improve",
    "ats_score",
    "gap_analysis",
    "job_matching",
    "job_fit_analysis",     # Granular: main fit scoring for job-candidate match
    "career_trajectory",    # Granular: growth path and adjacent roles analysis
    "career_advice",        # Granular: summary recommendations based on matches
    "query_optimization",   # Granular: search query scoring and validation
    "company_intel",        # Company research with Google Search grounding
    "predicted_questions",  # Interview question generation from company context
    "story_mapping",        # STAR story to company context mapping
    "cover_letter",
    "transcript",
    "feedback",
    "text_interview",       # Text-based interview responses
    "default"
]


def get_model_for_task(task: TaskType) -> str:
    """Get the appropriate model name for a given task.

    Returns the task-specific model if configured, otherwise the default model.
    For granular sub-tasks, falls back to parent task model if not set.
    """
    # Granular job-matching sub-tasks with fallback to job_matching
    job_matching_fallback = settings.gemini_model_job_matching or settings.gemini_model

    # Company intel sub-tasks with fallback to company_intel
    company_intel_fallback = settings.gemini_model_company_intel or settings.gemini_model

    task_model_map = {
        "resume_parse": settings.gemini_model_resume_parse,
        "resume_parse_basic": settings.gemini_model_resume_parse_basic,
        "resume_parse_career": settings.gemini_model_resume_parse_career,
        "resume_improve": settings.gemini_model_resume_improve,
        "ats_score": settings.gemini_model_ats_score,
        "gap_analysis": settings.gemini_model_gap_analysis,
        "job_matching": settings.gemini_model_job_matching,
        # Granular job-matching sub-tasks (fall back to job_matching if not set)
        "job_fit_analysis": settings.gemini_model_job_fit_analysis or job_matching_fallback,
        "career_trajectory": settings.gemini_model_career_trajectory or job_matching_fallback,
        "career_advice": settings.gemini_model_career_advice or job_matching_fallback,
        "query_optimization": settings.gemini_model_query_optimization or job_matching_fallback,
        # Company intel sub-tasks (fall back to company_intel if not set)
        "company_intel": settings.gemini_model_company_intel,
        "predicted_questions": settings.gemini_model_predicted_questions or company_intel_fallback,
        "story_mapping": settings.gemini_model_story_mapping or company_intel_fallback,
        "cover_letter": settings.gemini_model_cover_letter,
        "transcript": settings.gemini_model_transcript,
        "feedback": settings.gemini_model_feedback,
        "text_interview": settings.gemini_model_text_interview,
    }

    # Return task-specific model if set, otherwise default
    task_model = task_model_map.get(task)
    if task_model:
        return task_model
    return settings.gemini_model


async def _stream_generate(
    client: genai.Client,
    model_name: str,
    prompt: str,
    config: GenerateContentConfig,
) -> AsyncGenerator[str, None]:
    """Streaming generation using thread executor."""
    chunk_queue: queue.Queue = queue.Queue()
    error_holder: list = []

    def sync_stream():
        try:
            print(f"[Gemini] Starting streaming generation with {model_name}...")
            for chunk in client.models.generate_content_stream(
                model=model_name,
                contents=prompt,
                config=config,
            ):
                if chunk.text:
                    chunk_queue.put(chunk.text)
            print(f"[Gemini] Streaming complete for {model_name}")
        except Exception as e:
            print(f"[Gemini] Streaming error: {e}")
            error_holder.append(e)
        finally:
            chunk_queue.put(None)  # Signal end

    thread = threading.Thread(target=sync_stream)
    thread.start()

    while True:
        if error_holder:
            thread.join()
            raise error_holder[0]

        try:
            chunk = chunk_queue.get(block=True, timeout=0.1)
            if chunk is None:
                break
            yield chunk
        except queue.Empty:
            await asyncio.sleep(0.01)
            continue

    thread.join()


async def generate_with_gemini(
    prompt: str,
    system_instruction: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 8096,
    response_mime_type: Optional[str] = None,
    model_override: Optional[str] = None,
    task: TaskType = "default",
    stream: bool = False,
    log_context: Optional[str] = None,
):
    """
    Generate text using Google Gemini.

    Args:
        prompt: The user prompt
        system_instruction: Optional system instruction
        temperature: Creativity parameter (0-1)
        max_tokens: Maximum tokens in response
        response_mime_type: Optional MIME type for response (e.g., "application/json")
        model_override: Optional specific model to use (overrides task-based selection)
        task: Task type for automatic model selection
        stream: If True, returns an async generator; otherwise, returns the full string.
        log_context: Optional descriptive context for logging (e.g., "job fit for Software Engineer")

    Returns:
        Generated text string or AsyncGenerator of text chunks.
    """
    client = get_client()

    # Determine which model to use
    if model_override:
        model_name = model_override
    elif task != "default":
        model_name = get_model_for_task(task)
    else:
        model_name = settings.gemini_model

    # Build the prompt with system instruction
    full_prompt = prompt
    if system_instruction:
        full_prompt = f"{system_instruction}\n\n{prompt}"

    # Build config - only include response_mime_type for Vertex AI (not supported by Google AI Studio)
    if settings.gcp_api_key:
        # Google AI Studio mode - don't use response_mime_type
        config = GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
    else:
        # Vertex AI mode - can use response_mime_type
        config = GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            response_mime_type=response_mime_type,
        )

    if stream:
        return _stream_generate(client, model_name, full_prompt, config)
    else:
        # Non-streaming: run sync call in executor
        context_str = f" ({log_context})" if log_context else ""
        print(f"[Gemini] Non-stream Generating {context_str}...")

        def _sync_generate():
            return client.models.generate_content(
                model=model_name,
                contents=full_prompt,
                config=config,
            )

        try:
            response = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, _sync_generate),
                timeout=300
            )
            print(f"[Gemini] ✓ Completed Generating {context_str}")

            # Debug: Log finish reason if available
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                finish_reason = getattr(candidate, 'finish_reason', None)
                if finish_reason:
                    print(f"[Gemini] Finish reason: {finish_reason}")
                    if str(finish_reason) in ['MAX_TOKENS', 'STOP', '2']:
                        print(f"[Gemini] ⚠️ Response may be truncated (finish_reason={finish_reason})")

            return response.text
        except asyncio.TimeoutError:
            print(f"[Gemini] ✗ Timeout{context_str}: Model took too long (>300s)")
            raise
        except Exception as e:
            print(f"[Gemini] ✗ Error{context_str}: {e}")
            raise


def _extract_json_from_response(response_text: str) -> str:
    """
    Extract JSON from Gemini response, handling various formats.

    Handles:
    - Pure JSON response
    - JSON wrapped in ```json ... ``` or ```JSON ... ```
    - JSON with leading text/explanation
    - JSON with trailing text
    """
    import re

    if not response_text:
        return ""

    cleaned = response_text.strip()

    # Handle ```json ... ``` or ``` ... ``` format (case-insensitive)
    if "```" in cleaned:
        # Match ```json or ```JSON or just ```
        match = re.search(r'```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```', cleaned)
        if match:
            cleaned = match.group(1).strip()
            # If the extracted content starts with "json", remove it
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()

    # If still not starting with {, try to find JSON object
    if not cleaned.startswith('{'):
        json_start = cleaned.find('{')
        if json_start != -1:
            # Find the matching closing brace
            brace_count = 0
            json_end = -1
            for i, char in enumerate(cleaned[json_start:]):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        json_end = json_start + i + 1
                        break
            if json_end != -1:
                cleaned = cleaned[json_start:json_end]

    return cleaned


async def analyze_transcript(transcript: list[dict], target_role: str) -> dict:
    """
    Analyze interview transcript using Gemini.

    Args:
        transcript: List of transcript entries
        target_role: The role being interviewed for

    Returns:
        Analysis results as a dictionary
    """
    system_instruction = """You are an expert interview coach and career advisor.
    Analyze interview transcripts and provide detailed, actionable feedback.
    Your feedback should be constructive, specific, and encouraging.
    Focus on both strengths and areas for improvement.

    CRITICAL: You must ONLY analyze the questions and answers that actually appear in the transcript.
    DO NOT invent, hallucinate, or make up questions that were not asked.
    DO NOT create fictional answers or responses.
    If the transcript only contains 1 question and 1 answer, only analyze that 1 Q&A pair."""

    # Format transcript for analysis
    formatted_transcript = _format_transcript(transcript)
    print(f"[Feedback] Transcript: {len(transcript)} entries, {len(formatted_transcript)} chars")

    # Debug: Log first 500 chars of formatted transcript to check for encoding issues
    print(f"[Feedback] Transcript preview: {formatted_transcript[:500]}...")

    # Debug: Check for unusual characters that might cause issues
    has_unusual = any(ord(c) > 127 for c in formatted_transcript)
    if has_unusual:
        print("[Feedback] WARNING: Transcript contains non-ASCII characters")

    # Count actual questions in transcript (agent messages that are questions)
    agent_messages = [e for e in transcript if e.get("speaker") == "agent"]
    question_count = len(agent_messages)

    prompt = f"""Analyze this interview transcript for a {target_role} position.

IMPORTANT INSTRUCTIONS:
- This transcript contains exactly {question_count} question(s) from the interviewer.
- You MUST analyze ONLY these {question_count} question(s) that appear in the transcript.
- DO NOT invent or hallucinate additional questions.
- DO NOT make up candidate responses that are not in the transcript.
- If there is only 1 question, provide analysis for only that 1 question.

TRANSCRIPT:
{formatted_transcript}

Provide a detailed analysis in the following JSON format.
The "question_analyses" array MUST contain exactly {question_count} item(s) - one for each actual question in the transcript:

{{
    "overall_assessment": "Brief overall assessment (2-3 sentences)",
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "areas_for_improvement": ["area 1", "area 2", "area 3"],
    "content_score": <0-100>,
    "delivery_score": <0-100>,
    "structure_score": <0-100>,
    "relevance_score": <0-100>,
    "question_analyses": [
        {{
            "question": "Copy the EXACT question from the transcript",
            "response_summary": "Summary of the candidate's ACTUAL response from transcript",
            "score": <0-100>,
            "feedback": "Specific feedback for this answer",
            "star_detected": {{
                "situation": "Detected situation or null",
                "task": "Detected task or null",
                "action": "Detected action or null",
                "result": "Detected result or null"
            }},
            "improvement_suggestion": "How to improve this answer"
        }}
    ]
}}

Ensure your response is valid JSON with exactly {question_count} question analysis entries."""

    # Fallback response if all retries fail
    fallback_response = {
        "overall_assessment": "Analysis completed",
        "strengths": ["Good effort throughout the interview"],
        "areas_for_improvement": ["Continue practicing with the STAR method"],
        "content_score": 70,
        "delivery_score": 70,
        "structure_score": 70,
        "relevance_score": 70,
        "question_analyses": [],
    }

    # Retry loop for more robust feedback generation
    MAX_RETRIES = 2
    last_error = None
    response_text = ""  # Initialize to avoid unbound variable

    # Log prompt size for debugging
    full_prompt_size = len(system_instruction) + len(prompt)
    print(f"[Feedback] Full prompt size: {full_prompt_size} chars")

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await generate_with_gemini(
                prompt=prompt,
                system_instruction=system_instruction,
                temperature=0.3,
                max_tokens=16000,  # Increased from 8096 for longer feedback
                response_mime_type="application/json",
                task="feedback",
                log_context=f"transcript_analysis_attempt_{attempt + 1}",
            )

            # Log raw response for debugging
            response_text = str(response) if response else ""
            print(f"[Feedback] Attempt {attempt + 1}: Raw response length: {len(response_text)}")
            print(f"[Feedback] Attempt {attempt + 1}: Response preview: {response_text[:300]}...")

            if not response_text:
                print(f"[Feedback] Attempt {attempt + 1}: Empty response from Gemini")
                if attempt < MAX_RETRIES:
                    continue
                return fallback_response

            # Use improved JSON extraction
            cleaned = _extract_json_from_response(response_text)

            if not cleaned:
                print(f"[Feedback] Attempt {attempt + 1}: Could not extract JSON from response")
                if attempt < MAX_RETRIES:
                    continue
                return fallback_response

            print(f"[Feedback] Attempt {attempt + 1}: Extracted JSON length: {len(cleaned)}")

            result = json.loads(cleaned)

            # Validate that we got question_analyses
            actual_questions = len(result.get("question_analyses", []))
            if actual_questions == 0 and question_count > 0:
                print(f"[Feedback] Attempt {attempt + 1}: No question_analyses but expected {question_count}")
                print(f"[Feedback] Response keys: {list(result.keys())}")
                if attempt < MAX_RETRIES:
                    continue
                # Return what we have even if question_analyses is empty
                return result

            # Validate question count matches
            if actual_questions != question_count:
                print(f"[Feedback] WARNING: Expected {question_count} questions, got {actual_questions}")

            print(f"[Feedback] Successfully parsed {actual_questions} question analyses")
            return result

        except json.JSONDecodeError as e:
            last_error = e
            print(f"[Feedback] Attempt {attempt + 1}: JSON parse failed: {e}")
            print(f"[Feedback] Raw response (first 500 chars): {response_text[:500] if response_text else 'N/A'}")
            if attempt < MAX_RETRIES:
                print(f"[Feedback] Retrying...")
                continue

        except Exception as e:
            last_error = e
            print(f"[Feedback] Attempt {attempt + 1}: Unexpected error: {e}")
            if attempt < MAX_RETRIES:
                continue

    # All retries exhausted
    print(f"[Feedback] All {MAX_RETRIES + 1} attempts failed. Last error: {last_error}")
    return fallback_response


def _format_transcript(transcript: list[dict]) -> str:
    """Format transcript entries into readable text."""
    lines = []
    for entry in transcript:
        speaker = "Interviewer" if entry.get("speaker") == "agent" else "Candidate"
        text = entry.get("text", "")
        lines.append(f"{speaker}: {text}")
    return "\n\n".join(lines)


async def _parse_resume_basic(raw_text: str) -> dict:
    """
    Extract basic resume information (name, skills, experience, etc.).

    This is part of the parallel resume parsing optimization.
    Uses a faster model for basic extraction.
    """
    system_instruction = """You are an expert resume parser.
    Extract structured information from resume text accurately.
    Only extract information that is clearly present in the text.
    Do NOT make up or infer information that isn't explicitly stated."""

    prompt = f"""Parse this resume and extract basic structured information.

RESUME TEXT:
{raw_text}

Extract the following information and return as JSON:
{{
    "name": "Full name of the candidate (look for the name at the top)",
    "email": "Email address if present",
    "phone": "Phone number if present",
    "location": {{
        "raw_address": "Full address or location as written on resume, or null if not found",
        "city": "City name if identifiable, or null",
        "state_province": "State/Province 2-letter code (e.g., ON, CA, NY, BC, TX), or null",
        "country": "Country name (e.g., Canada, United States), or null",
        "country_code": "ISO country code lowercase (ca, us, uk, au), or null"
    }},
    "summary": "Professional summary or objective if present (2-3 sentences max)",
    "skills": ["skill1", "skill2", ...],
    "experience": [
        {{
            "title": "Job title",
            "company": "Company name",
            "start_date": "Start date if present",
            "end_date": "End date or 'Present' if current",
            "description": "Brief description of role"
        }}
    ],
    "education": [
        {{
            "degree": "Degree type (e.g., Bachelor's, Master's, PhD)",
            "field": "Field of study",
            "institution": "School/University name",
            "graduation_date": "Graduation date if present"
        }}
    ],
    "key_achievements": ["Top 3-5 notable achievements from the resume"],
    "suggested_roles": ["3-5 job titles this candidate would be good for"]
}}

IMPORTANT:
- Extract the ACTUAL name, not headers like "RESUME"
- Only include skills explicitly mentioned
- If information is unclear, use null
- For location: Look in header/contact section for address, city, or location info
  - Common formats: "City, State", "City, Province, Country", "123 Main St, City, ST ZIP"
  - Normalize state/province to 2-letter codes (Ontario→ON, California→CA, British Columbia→BC)
  - Infer country from state/province if not explicit (ON,BC,QC,AB→Canada; CA,NY,TX,WA→United States)
  - Canadian provinces: AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT
  - If only city is found without state/province, still extract the city

Return ONLY valid JSON, no markdown code blocks."""

    try:
        response = await generate_with_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.3,
            max_tokens=4096,
            response_mime_type="application/json",
            task="resume_parse_basic",
            log_context="basic resume extraction",
        )

        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]

        return json.loads(cleaned.strip())
    except Exception as e:
        print(f"[Gemini] Basic resume parsing failed: {e}")
        return {
            "name": None,
            "email": None,
            "phone": None,
            "location": None,
            "summary": None,
            "skills": [],
            "experience": [],
            "education": [],
            "key_achievements": [],
            "suggested_roles": [],
        }


async def _parse_resume_career_analysis(raw_text: str) -> dict:
    """
    Extract career analysis (skill_graph, star_stories, talking_points).

    This is part of the parallel resume parsing optimization.
    Uses a more capable model for complex career analysis.
    """
    current_date = datetime.now().strftime("%B %d, %Y")

    system_instruction = f"""You are an expert career advisor and interview coach.
    Analyze resume text to provide career insights, skill assessments, and STAR stories.
    Only extract information that is clearly present in the text.
    Do NOT make up or infer information that isn't explicitly stated.
    Analyze career trajectory, skill levels, and prepare STAR stories for interviews.

    IMPORTANT: Today's date is {current_date}. Use this to accurately calculate years of experience
    and skill duration. Only count experience up to the current date - do not count future dates."""

    prompt = f"""Analyze this resume and extract career insights.

RESUME TEXT:
{raw_text}

Extract the following career analysis and return as JSON:
{{
    "skill_graph": {{
        "technical": [
            {{
                "name": "Skill name",
                "level": "beginner|intermediate|expert",
                "years": 2,
                "evidence": "Brief evidence from resume"
            }}
        ],
        "soft": [
            {{
                "name": "Leadership",
                "level": "intermediate",
                "years": null,
                "evidence": "Led team of 5"
            }}
        ],
        "certifications": ["List of certifications"]
    }},

    "career_signals": {{
        "seniority_level": "entry|junior|mid|senior|lead|executive",
        "industry_focus": ["fintech", "healthcare", etc],
        "career_trajectory": "e.g., 'IC to Lead', 'Specialist', 'Generalist'",
        "years_experience": 6
    }},

    "star_stories": [
        {{
            "theme": "leadership|problem-solving|technical|teamwork|innovation",
            "situation": "The context/background (1-3 sentences)",
            "task": "What needed to be done (1-2 sentence)",
            "action": "Specific actions taken (2-3 sentences)",
            "result": "Quantifiable outcome (1-2 sentences)",
            "metrics": ["$2M saved", "40% improvement"],
            "keywords": ["project management", "agile"]
        }}
    ],

    "talking_points": {{
        "elevator_pitch": "30-second pitch summarizing their value proposition",
        "key_strengths": ["Top 3 unique strengths for interviews"],
        "unique_value": "What makes them stand out from other candidates"
    }}
}}

INSTRUCTIONS:
1. SKILL ASSESSMENT:
   - Determine skill level based on: years mentioned, depth of use, project complexity
   - "beginner": mentioned but limited use, "intermediate": regular use, "expert": deep expertise
   - Include both technical (programming, tools) and soft skills (leadership, communication)

2. CAREER SIGNALS:
   - Seniority: infer from job titles and responsibilities
   - Industries: identify sectors they've worked in
   - Trajectory: identify career pattern (e.g., "Developer → Tech Lead", "Generalist")

3. STAR STORIES:
   - Extract 2-5 accomplishments that can be told as STAR stories
   - Each must have clear Situation, Task, Action, Result
   - Prioritize stories with metrics and quantifiable results
   - Tag with interview themes (leadership, problem-solving, etc.)

4. TALKING POINTS:
   - Create a compelling elevator pitch from their experience
   - Identify unique value proposition vs typical candidates

IMPORTANT:
- Only create STAR stories if clear accomplishments are described
- If information is unclear, use null

Return ONLY valid JSON, no markdown code blocks."""

    try:
        response = await generate_with_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.25,
            max_tokens=16384,  # Increased for complex career analysis
            response_mime_type="application/json",
            task="resume_parse_career",
            log_context="career analysis",
        )

        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]

        return json.loads(cleaned.strip())
    except Exception as e:
        print(f"[Gemini] Career analysis parsing failed: {e}")
        return {
            "skill_graph": None,
            "career_signals": None,
            "star_stories": [],
            "talking_points": None,
        }


async def parse_resume_with_gemini(raw_text: str) -> dict:
    """
    Parse resume text using Gemini AI for accurate extraction with enhanced analysis.

    Uses parallel Gemini calls for faster processing:
    - Basic extraction (name, skills, experience) - uses faster model
    - Career analysis (skill_graph, star_stories) - uses more capable model

    Args:
        raw_text: Raw text extracted from PDF/DOCX

    Returns:
        Structured resume data with skill graph, career signals, and STAR stories
    """
    start_time = time.time()
    print("[Gemini] Starting parallel resume parsing...")

    # Run both extractions in parallel using asyncio.gather
    results = await asyncio.gather(
        _parse_resume_basic(raw_text),
        _parse_resume_career_analysis(raw_text),
        return_exceptions=True
    )

    basic_result = results[0]
    career_result = results[1]

    # Handle exceptions gracefully
    if isinstance(basic_result, Exception):
        print(f"[Gemini] Basic parsing failed with exception: {basic_result}")
        basic_result = {
            "name": None,
            "email": None,
            "phone": None,
            "summary": None,
            "skills": [],
            "experience": [],
            "education": [],
            "key_achievements": [],
            "suggested_roles": [],
        }

    if isinstance(career_result, Exception):
        print(f"[Gemini] Career analysis failed with exception: {career_result}")
        career_result = {
            "skill_graph": None,
            "career_signals": None,
            "star_stories": [],
            "talking_points": None,
        }

    # Merge results (basic takes precedence for any overlapping keys)
    merged_result = {**career_result, **basic_result}

    elapsed = time.time() - start_time
    print(f"[Gemini] Parallel resume parsing completed in {elapsed:.2f}s")

    # Validate we have something useful
    if not (merged_result.get("name") or merged_result.get("skills") or merged_result.get("experience")):
        print("[Gemini] Warning: Merged result appears empty")

    return merged_result


async def calculate_ats_score_and_keywords(raw_text: str, skills: list[str], target_role: str = None) -> dict:
    """
    Calculate ATS optimization score and suggest industry-specific keywords.

    Args:
        raw_text: Raw resume text
        skills: List of extracted skills
        target_role: Optional target role for keyword suggestions

    Returns:
        Dictionary with ATS score, issues, and keyword suggestions
    """
    current_date = datetime.now().strftime("%B %d, %Y")

    system_instruction = f"""You are an ATS (Applicant Tracking System) expert and resume optimization specialist.
    Analyze resumes for ATS compatibility and suggest improvements.

    IMPORTANT: Today's date is {current_date}. Use this to identify any dates in the resume that are in the future,
    which would be a critical error (e.g., employment start dates that haven't occurred yet)."""

    prompt = f"""Analyze this resume for ATS optimization and provide keyword recommendations.

RESUME TEXT:
{raw_text}

EXTRACTED SKILLS: {', '.join(skills)}
TARGET ROLE: {target_role or 'General professional role'}

Provide analysis as JSON:
{{
    "ats_score": <0-100, where 100 is perfectly ATS-optimized>,
    "score_breakdown": {{
        "structure_clarity": <0-100>,
        "keyword_density": <0-100>,
        "quantifiable_achievements": <0-100>,
        "contact_information": <0-100>,
        "formatting_simplicity": <0-100>
    }},
    "ats_issues": [
        {{
            "issue": "Issue title e.g., 'Missing clear section headers'",
            "description": "Detailed explanation of the issue and why it matters",
            "severity": "high|medium|low"
        }}
    ],
    "keyword_gaps": [
        {{
            "keyword": "Missing keyword relevant to role",
            "category": "technical|soft|industry|certification",
            "importance": "high|medium|low",
            "where_to_add": "Suggestion on where to incorporate this"
        }}
    ],
    "formatting_tips": [
        "Tip 1: Use standard section headers like 'EXPERIENCE', 'EDUCATION', 'SKILLS'",
        "Tip 2: Include quantifiable metrics (%, $, numbers)",
        "Tip 3: Use consistent date formatting (MM/YYYY)",
        "Tip 4: Avoid tables, text boxes, headers/footers",
        "Tip 5: Use standard fonts (Arial, Calibri, Times New Roman)"
    ],
    "industry_keywords": {{
        "must_have": ["Critical keyword 1", "Critical keyword 2"],
        "nice_to_have": ["Recommended keyword 1", "Recommended keyword 2"],
        "trending": ["Emerging skill 1", "Emerging skill 2"]
    }}
}}

SCORING CRITERIA:
- Structure Clarity: Clear section headers, logical flow
- Keyword Density: Appropriate use of role-specific keywords vs filler words
- Quantifiable Achievements: Presence of numbers, metrics, percentages
- Contact Information: Email, phone clearly visible
- Formatting Simplicity: Plain text friendly, no complex formatting

Return ONLY valid JSON."""

    try:
        response = await generate_with_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.2,
            max_tokens=8048,
            response_mime_type="application/json",
            task="ats_score",
        )

        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]

        return json.loads(cleaned.strip())
    except json.JSONDecodeError as e:
        print(f"[Gemini] Failed to parse ATS score JSON: {e}")
        return {
            "ats_score": 70,
            "score_breakdown": {
                "structure_clarity": 70,
                "keyword_density": 70,
                "quantifiable_achievements": 70,
                "contact_information": 80,
                "formatting_simplicity": 70,
            },
            "ats_issues": [{"issue": "Unable to analyze", "description": "Unable to analyze ATS compatibility fully", "severity": "low"}],
            "keyword_gaps": [],
            "formatting_tips": [
                "Use standard section headers (EXPERIENCE, EDUCATION, SKILLS)",
                "Include quantifiable achievements with metrics",
                "Keep formatting simple and ATS-friendly",
            ],
            "industry_keywords": {
                "must_have": [],
                "nice_to_have": [],
                "trending": [],
            },
        }


async def analyze_gap_for_role(resume_data: dict, target_role: str) -> dict:
    """
    Analyze skill gaps for a specific target role.

    Args:
        resume_data: Parsed resume data
        target_role: The role to analyze for

    Returns:
        Gap analysis with readiness score and recommendations
    """
    system_instruction = """You are an expert career advisor and recruiter.
    Analyze a candidate's resume against a target role to identify gaps and provide
    actionable recommendations for improvement."""

    skills = resume_data.get("skills", [])
    experience = resume_data.get("experience", [])
    skill_graph = resume_data.get("skill_graph", {})

    prompt = f"""Analyze this candidate's readiness for the role: {target_role}

CANDIDATE PROFILE:
Skills: {', '.join(skills[:15])}
Experience: {len(experience)} roles
Skill Graph: {json.dumps(skill_graph, indent=2) if skill_graph else 'Not analyzed'}

TARGET ROLE: {target_role}

Provide gap analysis as JSON:
{{
    "target_role": "{target_role}",
    "readiness_score": <0-100>,
    "strengths_for_role": ["Strength 1 that matches role", "Strength 2"],
    "gaps": [
        {{
            "skill": "Missing skill name",
            "importance": "low|medium|high",
            "current_level": "none|beginner|intermediate",
            "required_level": "intermediate|expert",
            "recommendation": "How to address this gap",
            "resources": [
                {{"type": "course", "title": "Course name", "url": ""}}
            ]
        }}
    ],
    "action_plan": {{
        "immediate": ["Action items for this week"],
        "30_days": ["Goals for next month"],
        "90_days": ["Longer-term preparation"]
    }}
}}

Return ONLY valid JSON."""

    response = await generate_with_gemini(
        prompt=prompt,
        system_instruction=system_instruction,
        temperature=0.3,
        max_tokens=8048,
        response_mime_type="application/json",
        task="gap_analysis",
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
            "target_role": target_role,
            "readiness_score": 50,
            "strengths_for_role": [],
            "gaps": [],
            "action_plan": {},
        }


async def generate_improved_resume(
    raw_text: str,
    ats_issues: list[dict],
    keyword_gaps: list[dict],
    formatting_tips: list[str],
    industry_keywords: dict,
) -> str:
    """
    Generate an improved version of the resume based on ATS analysis.

    Args:
        raw_text: Original resume text
        ats_issues: List of ATS issue objects with issue, description, severity
        keyword_gaps: List of missing keywords with importance
        formatting_tips: List of formatting recommendations
        industry_keywords: Dict with mustHave, niceToHave, trending keywords

    Returns:
        Improved resume in Markdown format
    """
    system_instruction = """You are an expert resume writer and career coach specializing in ATS optimization.
    Your task is to rewrite and improve resumes to be more effective, impactful, and ATS-friendly.
    You maintain the candidate's authentic experience while enhancing presentation and keyword optimization."""

    keyword_gaps_text = ""
    for gap in keyword_gaps:
        importance = gap.get("importance", "medium")
        keyword = gap.get("keyword", "")
        where = gap.get("whereToAdd", gap.get("where_to_add", ""))
        keyword_gaps_text += f"- [{importance.upper()}] {keyword}"
        if where:
            keyword_gaps_text += f" (suggested location: {where})"
        keyword_gaps_text += "\n"

    must_have = industry_keywords.get("mustHave", [])
    nice_to_have = industry_keywords.get("niceToHave", [])
    trending = industry_keywords.get("trending", [])

    industry_keywords_text = ""
    if must_have:
        industry_keywords_text += f"Must Have: {', '.join(must_have)}\n"
    if nice_to_have:
        industry_keywords_text += f"Nice to Have: {', '.join(nice_to_have)}\n"
    if trending:
        industry_keywords_text += f"Trending: {', '.join(trending)}\n"

    system_instruction = """You are an expert resume writer and career coach specializing in ATS optimization.
    Your task is to rewrite and improve resumes to be more effective, impactful, and ATS-friendly.
    You maintain the candidate's authentic experience while enhancing presentation and keyword optimization."""

    keyword_gaps_text = ""
    for gap in keyword_gaps:
        importance = gap.get("importance", "medium")
        keyword = gap.get("keyword", "")
        where = gap.get("whereToAdd", gap.get("where_to_add", ""))
        keyword_gaps_text += f"- [{importance.upper()}] {keyword}"
        if where:
            keyword_gaps_text += f" (suggested location: {where})"
        keyword_gaps_text += "\n"

    must_have = industry_keywords.get("mustHave", [])
    nice_to_have = industry_keywords.get("niceToHave", [])
    trending = industry_keywords.get("trending", [])

    industry_keywords_text = ""
    if must_have:
        industry_keywords_text += f"Must Have: {', '.join(must_have)}\n"
    if nice_to_have:
        industry_keywords_text += f"Nice to Have: {', '.join(nice_to_have)}\n"
    if trending:
        industry_keywords_text += f"Trending: {', '.join(trending)}\n"

    prompt = f"""Please generate an improved version of the following resume, addressing all the identified issues.

    ## ORIGINAL RESUME:
    {raw_text}

    ## ISSUES TO FIX:
    {chr(10).join(f"- [{i.get('severity', 'medium').upper()}] {i.get('issue', '')}: {i.get('description', '')}" for i in ats_issues) if ats_issues else "- No critical issues identified"}

    ## MISSING KEYWORDS TO INCORPORATE:
    {keyword_gaps_text if keyword_gaps_text else "- No keyword gaps identified"}

    ## FORMATTING RECOMMENDATIONS:
    {chr(10).join(f"- {tip}" for tip in formatting_tips) if formatting_tips else "- No formatting changes needed"}

    ## INDUSTRY KEYWORDS TO CONSIDER:
    {industry_keywords_text if industry_keywords_text else "- None specified"}

    ## INSTRUCTIONS:
    1. Fix ALL the identified issues
    2. Naturally incorporate the missing keywords where appropriate
    3. Follow the formatting recommendations
    4. Maintain the candidate's authentic experience - do NOT fabricate achievements
    5. Use strong action verbs and quantify achievements where possible
    6. Ensure clean, consistent formatting throughout
    7. Optimize OUTPUT for ATS parsing while remaining presentable and human-readable

    ## OUTPUT FORMAT CONSTRAINTS:
    Generate the improved resume in clean Markdown format with proper spacing using the following contraints.
    - Use a single # for the candidate's name as the main header
    - Use ## for each major section (SUMMARY, EXPERIENCE, SKILLS, EDUCATION, etc.)
    - IMPORTANT: Add a blank line BEFORE and AFTER each section header for proper spacing
    - Add a blank line between each job entry, education entry, or distinct content block
    - Italize and place the company name, location and dates on a new single line below the position name.
    - Use bullet points (- or *) for achievements, responsibilities and skills list
    - Keep it professional, well-structured and with high quality format and layout ready for print or convert to PDF for submission to employers.
    - Do NOT include any explanations or notes, only the improved markdown formatted resume content.

    """

    response = await generate_with_gemini(
        prompt=prompt,
        system_instruction=system_instruction,
        temperature=0.13,
        max_tokens=8096,
        task="resume_improve",
    )

    print(f"[Gemini ++] Generated improved resume {response[:500]}...")
    return response


async def generate_improved_resume_stream(
    raw_text: str,
    ats_issues: list[dict],
    keyword_gaps: list[dict],
    formatting_tips: list[str],
    industry_keywords: dict,
) -> AsyncGenerator[str, None]:
    """
    Generate an improved version of the resume with streaming output.

    This is an async generator that yields text chunks as they are generated.
    """
    system_instruction = """You are an expert resume writer and career coach specializing in ATS optimization.
    Your task is to rewrite and improve resumes to be more effective, impactful, and ATS-friendly.
    You maintain the candidate's authentic experience while enhancing presentation and keyword optimization."""

    keyword_gaps_text = ""
    for gap in keyword_gaps:
        importance = gap.get("importance", "medium")
        keyword = gap.get("keyword", "")
        where = gap.get("whereToAdd", gap.get("where_to_add", ""))
        keyword_gaps_text += f"- [{importance.upper()}] {keyword}"
        if where:
            keyword_gaps_text += f" (suggested location: {where})"
        keyword_gaps_text += "\n"

    must_have = industry_keywords.get("mustHave", [])
    nice_to_have = industry_keywords.get("niceToHave", [])
    trending = industry_keywords.get("trending", [])

    industry_keywords_text = ""
    if must_have:
        industry_keywords_text += f"Must Have: {', '.join(must_have)}\n"
    if nice_to_have:
        industry_keywords_text += f"Nice to Have: {', '.join(nice_to_have)}\n"
    if trending:
        industry_keywords_text += f"Trending: {', '.join(trending)}\n"

    prompt = f"""Please generate an improved version of the following resume, addressing all the identified issues.

## ORIGINAL RESUME:
{raw_text}

## ISSUES TO FIX:
{chr(10).join(f"- [{i.get('severity', 'medium').upper()}] {i.get('issue', '')}: {i.get('description', '')}" for i in ats_issues) if ats_issues else "- No critical issues identified"}

## MISSING KEYWORDS TO INCORPORATE:
{keyword_gaps_text if keyword_gaps_text else "- No keyword gaps identified"}

## FORMATTING RECOMMENDATIONS:
{chr(10).join(f"- {tip}" for tip in formatting_tips) if formatting_tips else "- No formatting changes needed"}

## INDUSTRY KEYWORDS TO CONSIDER:
{industry_keywords_text if industry_keywords_text else "- None specified"}

## INSTRUCTIONS:
1. Fix ALL the identified issues
2. Naturally incorporate the missing keywords where appropriate
3. Follow the formatting recommendations
4. Maintain the candidate's authentic experience - do NOT fabricate achievements
5. Use strong action verbs and quantify achievements where possible
6. Ensure clean, consistent formatting throughout
7. Optimize OUTPUT for ATS parsing while remaining presentable and human-readable

## OUTPUT FORMAT CONSTRAINTS:
Generate the improved resume in clean Markdown format with proper spacing using the following contraints.
- Use a single # for the candidate's name as the main header
- Use ## for each major section (SUMMARY, EXPERIENCE, SKILLS, EDUCATION, etc.)
- IMPORTANT: Add a blank line BEFORE and AFTER each section header for proper spacing
- Add a blank line between each job entry, education entry, or distinct content block
- Italize and place the company name, location and dates on a new single line below the position name.
- Use bullet points (- or *) for achievements, responsibilities and skills list
- Keep it professional, well-structured and with high quality format and layout ready for print or convert to PDF for submission to employers.
- Do NOT include any explanations or notes, only the improved markdown formatted resume content.

"""

    full_prompt = f"{system_instruction}\n\n{prompt}"
    model_name = get_model_for_task("resume_improve")

    config = GenerateContentConfig(
        temperature=0.13,
        max_output_tokens=8096,
    )

    print(f"[ResumeImprove Stream] Starting streaming generation with {model_name}")

    async for chunk in _stream_generate(get_client(), model_name, full_prompt, config):
        yield chunk

    print("[ResumeImprove Stream] Completed")


# =============================================================================
# GEMINI TTS (Text-to-Speech) FUNCTIONS
# =============================================================================

# Available Gemini TTS voices with descriptions
GEMINI_TTS_VOICES = [
    {"name": "Kore", "description": "Warm, professional female"},
    {"name": "Puck", "description": "Energetic, friendly male"},
    {"name": "Zephyr", "description": "Calm, soothing neutral"},
    {"name": "Charon", "description": "Steady, measured male"},
    {"name": "Aoede", "description": "Clear, articulate female"},
    {"name": "Fenrir", "description": "Deep, authoritative male"},
    {"name": "Leda", "description": "Gentle, encouraging female"},
    {"name": "Orus", "description": "Confident, professional male"},
    {"name": "Proteus", "description": "Dynamic, versatile male"},
    {"name": "Callirrhoe", "description": "Warm, melodic female"},
]

DEFAULT_TTS_VOICE = "Kore"
TTS_SAMPLE_RATE = 24000  # Gemini TTS outputs 24kHz audio


def _pcm_to_wav(pcm_data: bytes, sample_rate: int = TTS_SAMPLE_RATE, channels: int = 1, sample_width: int = 2) -> bytes:
    """
    Convert raw PCM audio data to WAV format for browser playback.

    Args:
        pcm_data: Raw PCM audio bytes
        sample_rate: Audio sample rate in Hz (Gemini uses 24000)
        channels: Number of audio channels (1 = mono)
        sample_width: Bytes per sample (2 = 16-bit)

    Returns:
        WAV audio data as bytes
    """
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)
    buffer.seek(0)
    return buffer.read()


async def generate_speech_with_gemini(
    text: str,
    voice_name: str = DEFAULT_TTS_VOICE,
    style_prompt: str = "warmly and encouragingly, like a supportive career coach",
) -> bytes:
    """
    Generate speech using Google Gemini TTS model.

    Uses the gemini-2.5-flash-preview-tts model to convert text to natural-sounding speech.
    The output is PCM audio converted to WAV format for browser compatibility.

    NOTE: This feature requires Vertex AI (billing enabled). It does not work with
    the Google AI Studio API key.

    Args:
        text: The text to convert to speech (max ~5000 characters recommended)
        voice_name: One of the 30 prebuilt Gemini voices (default: Kore)
        style_prompt: Natural language description of speaking style

    Returns:
        WAV audio data as bytes

    Raises:
        ValueError: If using API key mode (TTS not supported)
        Exception: If TTS generation fails
    """
    from google.genai import types

    # Check if using API key mode - TTS not supported
    if settings.gcp_api_key:
        raise ValueError(
            "Gemini TTS (Reader Mode) requires Vertex AI with billing enabled. "
            "It is not available with the Google AI Studio API key. "
            "Please disable Reader Mode or enable billing on your GCP project."
        )

    client = get_client()

    # Build content with style direction
    # The style prompt helps Gemini deliver the text with appropriate tone
    if style_prompt:
        content = f"Say this {style_prompt}: {text}"
    else:
        content = text

    print(f"[Gemini TTS] Generating speech with voice '{voice_name}'...")

    def _sync_generate_tts():
        return client.models.generate_content(
            model="gemini-2.5-flash-tts",
            contents=content,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_name,
                        )
                    )
                ),
            ),
        )

    try:
        # Run synchronous TTS generation in executor (same pattern as other Gemini calls)
        response = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(None, _sync_generate_tts),
            timeout=60  # TTS should complete within 60 seconds
        )

        # Extract PCM audio data from response
        # The audio is returned as base64-encoded PCM in inline_data
        audio_part = response.candidates[0].content.parts[0]

        if hasattr(audio_part, "inline_data") and audio_part.inline_data:
            pcm_data = audio_part.inline_data.data
            # If data is base64 encoded string, decode it
            if isinstance(pcm_data, str):
                pcm_data = base64.b64decode(pcm_data)

            # Convert PCM to WAV for browser playback
            wav_data = _pcm_to_wav(pcm_data)
            print(f"[Gemini TTS] ✓ Generated {len(wav_data)} bytes of WAV audio")
            return wav_data
        else:
            raise ValueError("No audio data in response")

    except asyncio.TimeoutError:
        print("[Gemini TTS] ✗ Timeout: TTS generation took too long (>60s)")
        raise
    except Exception as e:
        print(f"[Gemini TTS] ✗ Error generating speech: {e}")
        raise


def get_available_tts_voices() -> list[dict]:
    """
    Get the list of available Gemini TTS voices with descriptions.

    Returns:
        List of voice dictionaries with 'name' and 'description' keys
    """
    return GEMINI_TTS_VOICES
