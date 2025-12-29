"""Company Intelligence service using Gemini with Google Search grounding."""

import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Any

from app.config import get_settings
from app.models.company_intel import (
    CompanyIntel,
    NewsItem,
    LeadershipChange,
    StrategicInitiative,
    CultureSignal,
    FinancialHealth,
    InterviewAngle,
    PredictedQuestion,
    StoryToCompanyMapping,
)
from app.models.resume import ResumeData
from app.services.gemini_service import get_model_for_task

settings = get_settings()

# Cache configuration
CACHE_TTL_HOURS = 4
_intel_cache: dict[str, tuple[CompanyIntel, datetime]] = {}


def _get_cache_key(company_name: str) -> str:
    """Generate cache key for company name."""
    normalized = company_name.lower().strip()
    return hashlib.md5(normalized.encode()).hexdigest()


def _get_cached_intel(company_name: str) -> Optional[CompanyIntel]:
    """Get cached company intel if still fresh."""
    cache_key = _get_cache_key(company_name)
    if cache_key in _intel_cache:
        intel, cached_at = _intel_cache[cache_key]
        if datetime.now() - cached_at < timedelta(hours=CACHE_TTL_HOURS):
            print(f"[CompanyIntel] Cache hit for '{company_name}'")
            return intel
        else:
            # Cache expired
            del _intel_cache[cache_key]
    return None


def _cache_intel(company_name: str, intel: CompanyIntel) -> None:
    """Cache company intel."""
    cache_key = _get_cache_key(company_name)
    _intel_cache[cache_key] = (intel, datetime.now())
    print(f"[CompanyIntel] Cached intel for '{company_name}'")


def _clean_json_response(text: str) -> str:
    """Clean markdown code blocks from JSON response."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _repair_json(text: str) -> str:
    """Attempt to repair truncated or malformed JSON."""
    text = text.strip()

    # Count opening and closing braces/brackets
    open_braces = text.count('{')
    close_braces = text.count('}')
    open_brackets = text.count('[')
    close_brackets = text.count(']')

    # If JSON appears truncated, try to close it properly
    if open_braces > close_braces or open_brackets > close_brackets:
        # Find the last complete value (ends with ", or ])
        # Try to find a good truncation point
        last_quote = text.rfind('"')
        if last_quote > 0:
            # Check what comes after the last quote
            after_quote = text[last_quote+1:].strip()
            if not after_quote or after_quote[0] not in [',', '}', ']', ':']:
                # Truncated in the middle of a string, find previous complete item
                text = text[:last_quote+1]

        # Close any open arrays first, then objects
        text = text.rstrip(',').rstrip()

        # Add missing closing brackets and braces
        while open_brackets > close_brackets:
            text += ']'
            close_brackets += 1
        while open_braces > close_braces:
            text += '}'
            close_braces += 1

    return text


async def _generate_intel_with_grounding(
    company_name: str,
    target_role: Optional[str] = None,
) -> dict[str, Any]:
    """
    Generate company intelligence using Gemini 2.5 with Google Search grounding.

    This is the core innovation - using live web search to get real-time
    company information for interview preparation.

    Uses the google.genai SDK with Vertex AI for Gemini 2.5.
    """
    import os
    from google import genai
    from google.genai.types import (
        GenerateContentConfig,
        GoogleSearch,
        HttpOptions,
        Tool,
    )

    # Configure for Vertex AI
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
    if settings.gcp_project_id:
        os.environ["GOOGLE_CLOUD_PROJECT"] = settings.gcp_project_id
    if settings.gcp_location:
        os.environ["GOOGLE_CLOUD_LOCATION"] = settings.gcp_location

    # Create client with stable API version
    client = genai.Client(http_options=HttpOptions(api_version="v1"))

    # Create Google Search tool for grounding
    google_search_tool = Tool(google_search=GoogleSearch())

    role_context = f" for a {target_role} position" if target_role else ""

    prompt = f"""You are a professional career intelligence analyst preparing a candidate for a job interview{role_context}.

Research {company_name} thoroughly and provide comprehensive intelligence for interview preparation.

IMPORTANT: Use current, real-time information from your search. Include specific dates, names, and facts you find.

Return a JSON object with EXACTLY this structure (no markdown, just JSON):
{{
    "companyName": "{company_name}",
    "industry": "The company's primary industry",
    "headquarters": "City, State/Country",
    "companySize": "Approximate employee count or size category",
    "founded": "Year founded if known",
    "website": "Company website URL",
    "executiveSummary": "2-3 sentence overview of what the company does and its market position",
    "keyTalkingPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
    "recentNews": [
        {{
            "title": "News headline",
            "summary": "Brief summary of the news",
            "date": "Date if known",
            "source": "Source name",
            "relevanceToInterview": "How this news could come up in your interview"
        }}
    ],
    "leadershipChanges": [
        {{
            "name": "Person name",
            "role": "Their role",
            "changeType": "new_hire|departure|promotion|restructure",
            "date": "When this happened",
            "implications": "What this means for the company"
        }}
    ],
    "strategicInitiatives": [
        {{
            "title": "Initiative name",
            "description": "What it involves",
            "relevance": "Why it matters",
            "interviewAngle": "How to reference this in your interview"
        }}
    ],
    "cultureSignals": [
        {{
            "signal": "What they value (e.g., 'Innovation-focused')",
            "evidence": "Evidence from job postings, reviews, or public statements",
            "interviewTip": "How to demonstrate alignment with this value"
        }}
    ],
    "financialHealth": {{
        "isPublic": true/false,
        "stockTrend": "Recent stock performance if public",
        "recentEarnings": "Recent earnings info if available",
        "growthIndicators": ["Growth indicator 1", "Growth indicator 2"],
        "concerns": ["Any concerns or challenges"]
    }},
    "interviewAngles": [
        {{
            "topic": "Topic to bring up",
            "whyRelevant": "Why this matters to the company",
            "howToUse": "Specific advice on how to leverage this",
            "samplePhrases": ["Example phrase 1", "Example phrase 2"]
        }}
    ]
}}

Focus on ACTIONABLE intelligence. Include 3-5 items for each array. If you cannot find information for a section, include an empty array but try to include at least some information for each section.

Be specific with dates, names, and facts. Generic information is not helpful."""

    print(f"[CompanyIntel] Generating intel for '{company_name}' with Google Search grounding...")

    try:
        import asyncio

        # Use the new google.genai client API with configurable model
        model_name = get_model_for_task("company_intel")

        def _sync_generate():
            return client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=GenerateContentConfig(
                    tools=[google_search_tool],
                    temperature=1.0,  # Recommended for grounding
                    max_output_tokens=8000,  # Increased for large responses
                ),
            )

        response = await asyncio.get_event_loop().run_in_executor(
            None, _sync_generate
        )

        # Extract text and parse JSON
        text = response.text
        text = _clean_json_response(text)

        print(f"[CompanyIntel] Received response for '{company_name}' ({len(text)} chars)")

        # Parse JSON with repair fallback
        try:
            intel_data = json.loads(text)
        except json.JSONDecodeError as e:
            print(f"[CompanyIntel] Initial JSON parse failed, attempting repair: {e}")
            repaired_text = _repair_json(text)
            intel_data = json.loads(repaired_text)
            print(f"[CompanyIntel] JSON repair successful")

        # Extract grounding sources if available
        sources = []
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                metadata = candidate.grounding_metadata
                # Check both that attribute exists AND is not None
                if hasattr(metadata, 'grounding_chunks') and metadata.grounding_chunks:
                    for chunk in metadata.grounding_chunks:
                        if hasattr(chunk, 'web') and chunk.web:
                            if chunk.web.uri:
                                sources.append(chunk.web.uri)

        intel_data['sources'] = sources[:10]  # Limit to 10 sources

        return intel_data

    except json.JSONDecodeError as e:
        print(f"[CompanyIntel] JSON parse error after repair attempt: {e}")
        print(f"[CompanyIntel] Raw response (first 1000 chars): {text[:1000]}...")
        print(f"[CompanyIntel] Raw response (last 500 chars): ...{text[-500:]}")
        raise ValueError(f"Failed to parse company intelligence response. The AI returned malformed data. Please try again.")
    except Exception as e:
        print(f"[CompanyIntel] Error generating intel: {e}")
        raise


async def _generate_predicted_questions(
    company_name: str,
    target_role: Optional[str],
    intel_context: dict[str, Any],
) -> list[PredictedQuestion]:
    """Generate interview questions based on company context."""
    import os
    from google import genai
    from google.genai.types import GenerateContentConfig, HttpOptions

    # Configure for Vertex AI
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
    if settings.gcp_project_id:
        os.environ["GOOGLE_CLOUD_PROJECT"] = settings.gcp_project_id
    if settings.gcp_location:
        os.environ["GOOGLE_CLOUD_LOCATION"] = settings.gcp_location

    client = genai.Client(http_options=HttpOptions(api_version="v1"))

    role_text = target_role or "this role"

    # Create context summary from intel
    context_summary = f"""
Company: {company_name}
Industry: {intel_context.get('industry', 'Unknown')}
Executive Summary: {intel_context.get('executiveSummary', '')}

Recent News:
{chr(10).join([f"- {n.get('title', '')}: {n.get('summary', '')}" for n in intel_context.get('recentNews', [])[:3]])}

Strategic Initiatives:
{chr(10).join([f"- {i.get('title', '')}: {i.get('description', '')}" for i in intel_context.get('strategicInitiatives', [])[:3]])}

Culture Signals:
{chr(10).join([f"- {c.get('signal', '')}" for c in intel_context.get('cultureSignals', [])[:3]])}
"""

    prompt = f"""Based on this company intelligence, predict 6-8 interview questions a {role_text} candidate would likely face at {company_name}.

COMPANY CONTEXT:
{context_summary}

For each question, explain WHY it's likely based on the company context (recent news, initiatives, culture).

Return a JSON array with this structure (no markdown, just JSON):
[
    {{
        "question": "The interview question",
        "type": "behavioral|technical|situational|company-specific",
        "reasoning": "Why this question is likely given the company context",
        "preparationTip": "How to prepare for this specific question",
        "relatedNews": "Which news/initiative prompted this prediction (if applicable)"
    }}
]

Make questions SPECIFIC to {company_name} based on the context provided. Avoid generic questions.
Include at least 2 company-specific questions that reference recent news or initiatives."""

    try:
        import asyncio

        model_name = get_model_for_task("predicted_questions")

        def _sync_generate():
            return client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=8096,
                ),
            )

        response = await asyncio.get_event_loop().run_in_executor(
            None, _sync_generate
        )

        text = _clean_json_response(response.text)
        questions_data = json.loads(text)

        questions = []
        for q in questions_data:
            questions.append(PredictedQuestion(
                question=q.get("question", ""),
                question_type=q.get("type", "behavioral"),
                reasoning=q.get("reasoning", ""),
                preparation_tip=q.get("preparationTip", ""),
                related_news=q.get("relatedNews"),
            ))

        print(f"[CompanyIntel] Generated {len(questions)} predicted questions")
        return questions

    except Exception as e:
        print(f"[CompanyIntel] Error generating questions: {e}")
        return []


async def _map_stories_to_company(
    resume_data: ResumeData,
    company_name: str,
    intel_context: dict[str, Any],
) -> list[StoryToCompanyMapping]:
    """Map candidate's STAR stories to company context."""
    if not resume_data.star_stories:
        return []

    import os
    from google import genai
    from google.genai.types import GenerateContentConfig, HttpOptions

    # Configure for Vertex AI
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
    if settings.gcp_project_id:
        os.environ["GOOGLE_CLOUD_PROJECT"] = settings.gcp_project_id
    if settings.gcp_location:
        os.environ["GOOGLE_CLOUD_LOCATION"] = settings.gcp_location

    client = genai.Client(http_options=HttpOptions(api_version="v1"))

    # Format STAR stories
    stories_text = ""
    for i, story in enumerate(resume_data.star_stories[:8], 1):  # Limit to 8 stories
        stories_text += f"""
Story {i}: {story.theme}
Summary: {story.situation[:200]}...
Action: {story.action[:150]}...
Result: {story.result[:150]}...
"""

    # Format company context
    initiatives_text = "\n".join([
        f"- {i.get('title', '')}: {i.get('description', '')}"
        for i in intel_context.get('strategicInitiatives', [])[:5]
    ])

    culture_text = "\n".join([
        f"- {c.get('signal', '')}"
        for c in intel_context.get('cultureSignals', [])[:5]
    ])

    prompt = f"""Map these candidate STAR stories to {company_name}'s context.

CANDIDATE'S STORIES:
{stories_text}

COMPANY CONTEXT:
Strategic Initiatives:
{initiatives_text}

Culture & Values:
{culture_text}

For each relevant story, explain:
1. Which company initiative/value it connects to
2. How to frame the story for this specific company
3. How much to emphasize it (1-10 score)

Return a JSON array (no markdown, just JSON):
[
    {{
        "storyTheme": "The story theme from above",
        "storySummary": "Brief 1-sentence summary",
        "companyInitiative": "Which company initiative/value this connects to",
        "connectionExplanation": "How/why this story connects",
        "framingTip": "Specific advice on how to tell this story for {company_name}",
        "emphasisScore": 8
    }}
]

Only include stories that have a clear, meaningful connection. Don't force connections.
Score meanings: 9-10 = Must tell this story, 7-8 = Strong fit, 5-6 = Worth mentioning, 1-4 = Skip"""

    try:
        import asyncio

        model_name = get_model_for_task("story_mapping")

        def _sync_generate():
            return client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=6096,
                ),
            )

        response = await asyncio.get_event_loop().run_in_executor(
            None, _sync_generate
        )

        text = _clean_json_response(response.text)
        mappings_data = json.loads(text)

        mappings = []
        for m in mappings_data:
            mappings.append(StoryToCompanyMapping(
                story_theme=m.get("storyTheme", ""),
                story_summary=m.get("storySummary", ""),
                company_initiative=m.get("companyInitiative", ""),
                connection_explanation=m.get("connectionExplanation", ""),
                framing_tip=m.get("framingTip", ""),
                emphasis_score=min(max(m.get("emphasisScore", 5), 1), 10),
            ))

        # Sort by emphasis score (highest first)
        mappings.sort(key=lambda x: x.emphasis_score, reverse=True)

        print(f"[CompanyIntel] Mapped {len(mappings)} stories to company context")
        return mappings

    except Exception as e:
        print(f"[CompanyIntel] Error mapping stories: {e}")
        return []


async def generate_company_intel(
    company_name: str,
    target_role: Optional[str] = None,
    resume_data: Optional[ResumeData] = None,
    include_questions: bool = True,
    include_story_mapping: bool = True,
) -> CompanyIntel:
    """
    Generate comprehensive company intelligence for interview preparation.

    This is the main entry point that orchestrates:
    1. Company research with Google Search grounding
    2. Interview question prediction
    3. STAR story mapping

    Args:
        company_name: Name of the company to research
        target_role: Optional target role for context
        resume_data: Optional resume data for story mapping
        include_questions: Whether to generate predicted questions
        include_story_mapping: Whether to map STAR stories

    Returns:
        CompanyIntel object with all intelligence sections
    """
    # Check cache first
    cached = _get_cached_intel(company_name)
    if cached:
        # Update freshness indicator
        cached_copy = cached.model_copy()
        cached_copy.data_freshness = "cached"
        return cached_copy

    import asyncio

    print(f"[CompanyIntel] Generating fresh intel for '{company_name}'...")

    # Step 1: Generate core intel with Google Search grounding (must complete first)
    intel_data = await _generate_intel_with_grounding(company_name, target_role)

    # Step 2 & 3: Run in PARALLEL (both depend only on Step 1, not each other)
    async def get_questions():
        if include_questions:
            return await _generate_predicted_questions(company_name, target_role, intel_data)
        return []

    async def get_story_mappings():
        if include_story_mapping and resume_data:
            return await _map_stories_to_company(resume_data, company_name, intel_data)
        return []

    predicted_questions, story_mappings = await asyncio.gather(
        get_questions(),
        get_story_mappings(),
    )

    # Build the CompanyIntel object
    # Use `or []` pattern because .get() returns None if key exists but value is null
    intel = CompanyIntel(
        company_name=intel_data.get("companyName") or company_name,
        industry=intel_data.get("industry"),
        headquarters=intel_data.get("headquarters"),
        company_size=intel_data.get("companySize"),
        founded=intel_data.get("founded"),
        website=intel_data.get("website"),
        generated_at=datetime.now().isoformat(),
        data_freshness="real-time",
        executive_summary=intel_data.get("executiveSummary") or "",
        key_talking_points=intel_data.get("keyTalkingPoints") or [],
        recent_news=[
            NewsItem(**n) for n in (intel_data.get("recentNews") or [])
        ],
        leadership_changes=[
            LeadershipChange(**lc) for lc in (intel_data.get("leadershipChanges") or [])
        ],
        strategic_initiatives=[
            StrategicInitiative(**si) for si in (intel_data.get("strategicInitiatives") or [])
        ],
        culture_signals=[
            CultureSignal(**cs) for cs in (intel_data.get("cultureSignals") or [])
        ],
        financial_health=FinancialHealth(**intel_data["financialHealth"])
            if intel_data.get("financialHealth") else None,
        interview_angles=[
            InterviewAngle(**ia) for ia in (intel_data.get("interviewAngles") or [])
        ],
        predicted_questions=predicted_questions,
        story_mappings=story_mappings,
        sources=intel_data.get("sources") or [],
    )

    # Cache the result
    _cache_intel(company_name, intel)

    print(f"[CompanyIntel] Successfully generated intel for '{company_name}'")
    return intel


def get_cache_expiry(company_name: str) -> Optional[datetime]:
    """Get when the cache for a company expires."""
    cache_key = _get_cache_key(company_name)
    if cache_key in _intel_cache:
        _, cached_at = _intel_cache[cache_key]
        return cached_at + timedelta(hours=CACHE_TTL_HOURS)
    return None
