"""AI-powered job matching service using Gemini."""

import asyncio
import json
from typing import Optional

from app.models.job import (
    CareerAdvice,
    CareerTrajectory,
    FitAnalysis,
    InterviewPrepPlan,
    JobMatch,
    JobPosting,
    PreparationItem,
    SkillMatch,
)
from app.models.resume import ResumeData
from app.services.gemini_service import generate_with_gemini
from app.services.jobboard_service import get_job_board_service


async def analyze_job_fit(
    resume_data: ResumeData,
    job: JobPosting,
) -> FitAnalysis:
    """
    Use Gemini to analyze how well a candidate fits a job.

    Args:
        resume_data: Parsed resume data
        job: Job posting to analyze

    Returns:
        FitAnalysis with match scores and recommendations
    """
    # Build candidate profile summary
    skills = resume_data.skills[:15] if resume_data.skills else []
    experience_summary = []
    for exp in resume_data.experience[:3]:
        exp_str = f"{exp.get('title', 'Role')} at {exp.get('company', 'Company')}"
        experience_summary.append(exp_str)

    skill_graph = resume_data.skill_graph
    career_signals = resume_data.career_signals

    # Safely serialize skill_graph and career_signals (may be Pydantic models or dicts)
    def safe_dump(obj):
        if obj is None:
            return {}
        if hasattr(obj, 'model_dump'):
            return obj.model_dump()
        if isinstance(obj, dict):
            return obj
        # Try to convert to dict
        return dict(obj) if hasattr(obj, '__iter__') else {}

    skill_graph_data = safe_dump(skill_graph)
    career_signals_data = safe_dump(career_signals)

    # Get company culture if available
    job_service = get_job_board_service()
    culture = job_service.get_company_culture(job.company)

    system_instruction = """You are an expert career advisor and job matching specialist.
    Analyze how well a candidate matches a job posting and provide actionable insights.
    Be honest about fit scores - don't inflate them. Identify real strengths and concerns."""

    prompt = f"""Analyze this candidate's fit for the job posting.

CANDIDATE PROFILE:
Skills: {', '.join(skills)}
Experience: {'; '.join(experience_summary)}
Skill Levels: {json.dumps(skill_graph_data, indent=2)}
Career Signals: {json.dumps(career_signals_data, indent=2)}

JOB POSTING:
Title: {job.title}
Company: {job.company}
Location: {job.location} ({job.remote_type})
Experience Level: {job.experience_level or 'Not specified'}

Requirements:
{chr(10).join('- ' + req for req in job.requirements)}

Nice to Have:
{chr(10).join('- ' + nth for nth in job.nice_to_have)}

Company Culture: {culture or 'Not specified'}

Return a JSON object with these fields (scores from 0-100):
- overall_match: Overall fit percentage
- skill_match: Skills alignment percentage  
- experience_match: Experience level match percentage
- culture_signals: Brief culture fit assessment string
- strengths_for_role: Array of 3 specific strengths
- potential_concerns: Array of 1-2 concerns or gaps
- interview_focus_areas: Array of 3 topics to prepare for
- preparation_priority: Array of objects with topic, urgency (high/medium/low), reason
- skill_matches: Array of objects with skill, required (bool), candidate_level, required_level, match_score

Be realistic with scores:
- 90+: Exceptional match, exceeds requirements
- 75-89: Strong match, meets most requirements
- 60-74: Good match with some gaps
- 45-59: Moderate match, significant gaps
- Below 45: Weak match, major gaps

Return ONLY valid JSON, no markdown code blocks."""

    response = await generate_with_gemini(
        prompt=prompt,
        system_instruction=system_instruction,
        temperature=0.25,
        max_tokens=8048,
        task="job_fit_analysis",
        log_context=f"job fit analysis for '{job.title}' at {job.company}",
    )

    try:
        cleaned = response.strip()
        # Handle markdown code blocks if present
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        data = json.loads(cleaned.strip())

        # Parse preparation items
        prep_items = []
        for item in data.get("preparation_priority", []):
            prep_items.append(
                PreparationItem(
                    topic=item.get("topic", ""),
                    urgency=item.get("urgency", "medium"),
                    reason=item.get("reason"),
                )
            )

        # Parse skill matches
        skill_matches = []
        for sm in data.get("skill_matches", []):
            skill_matches.append(
                SkillMatch(
                    skill=sm.get("skill", ""),
                    required=sm.get("required", True),
                    candidate_level=sm.get("candidate_level"),
                    required_level=sm.get("required_level"),
                    match_score=sm.get("match_score", 0),
                )
            )

        return FitAnalysis(
            overall_match=data.get("overall_match", 50),
            skill_match=data.get("skill_match", 50),
            experience_match=data.get("experience_match", 50),
            culture_signals=data.get("culture_signals"),
            strengths_for_role=data.get("strengths_for_role", []),
            potential_concerns=data.get("potential_concerns", []),
            interview_focus_areas=data.get("interview_focus_areas", []),
            preparation_priority=prep_items,
            skill_matches=skill_matches,
        )
    except json.JSONDecodeError:
        # Return default analysis on failure
        return FitAnalysis(
            overall_match=50,
            skill_match=50,
            experience_match=50,
            culture_signals="Unable to analyze",
            strengths_for_role=[],
            potential_concerns=["Analysis unavailable"],
            interview_focus_areas=[],
            preparation_priority=[],
            skill_matches=[],
        )


async def analyze_career_trajectory(
    resume_data: ResumeData,
    job: JobPosting,
) -> CareerTrajectory:
    """
    Analyze career trajectory implications of taking a job.

    Args:
        resume_data: Parsed resume data
        job: Job posting to analyze

    Returns:
        CareerTrajectory insights
    """
    career_signals = resume_data.career_signals
    
    # Safely access career_signals fields (may be dict or Pydantic model)
    def get_signal(field: str, default=None):
        if career_signals is None:
            return default
        if isinstance(career_signals, dict):
            return career_signals.get(field, default)
        return getattr(career_signals, field, default)
    
    experience_years = get_signal('years_experience')
    seniority = get_signal('seniority_level', 'Unknown')
    trajectory = get_signal('career_trajectory', 'Unknown')
    industries = get_signal('industry_focus', [])

    system_instruction = """You are an expert career advisor.
    Analyze how a job fits into a candidate's career trajectory.
    Provide realistic, actionable career path insights."""

    prompt = f"""Analyze the career trajectory implications for this candidate considering this job.

CANDIDATE:
Current Level: {seniority}
Years Experience: {experience_years or 'Unknown'}
Career Pattern: {trajectory}
Industries: {', '.join(industries) if industries else 'Various'}

JOB:
Title: {job.title}
Company: {job.company}
Level: {job.experience_level or 'Not specified'}

Provide career trajectory analysis as JSON:
{{
    "current_fit": "How this role fits their current career stage",
    "growth_path": "Potential growth from this role (e.g., 'Could lead to Staff Engineer in 2-3 years')",
    "adjacent_roles": ["Related roles this could lead to"],
    "long_term_outlook": "Long-term career implications",
    "time_to_next_level": "Estimated time to next level (e.g., '2-3 years')"
}}

Return ONLY valid JSON."""

    response = await generate_with_gemini(
        prompt=prompt,
        system_instruction=system_instruction,
        temperature=0.3,
        max_tokens=4048,
        task="career_trajectory",
        log_context=f"career trajectory for '{job.title}' at {job.company}",
    )

    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        data = json.loads(cleaned.strip())

        return CareerTrajectory(
            current_fit=data.get("current_fit", "Good match for current level"),
            growth_path=data.get("growth_path"),
            adjacent_roles=data.get("adjacent_roles", []),
            long_term_outlook=data.get("long_term_outlook"),
            time_to_next_level=data.get("time_to_next_level"),
        )
    except json.JSONDecodeError:
        return CareerTrajectory(
            current_fit="Analysis unavailable",
            growth_path=None,
            adjacent_roles=[],
            long_term_outlook=None,
            time_to_next_level=None,
        )


async def generate_career_advice(
    resume_data: ResumeData,
    matched_jobs: list[JobMatch],
) -> CareerAdvice:
    """
    Generate overall career advice based on resume and job matches.

    Args:
        resume_data: Parsed resume data
        matched_jobs: List of matched jobs

    Returns:
        CareerAdvice with recommendations
    """
    skills = resume_data.skills[:10] if resume_data.skills else []
    career_signals = resume_data.career_signals

    # Summarize job matches
    job_summaries = []
    for match in matched_jobs[:5]:
        job_summaries.append(
            f"{match.job.title} at {match.job.company} ({match.fit_analysis.overall_match}% match)"
        )

    system_instruction = """You are an expert career advisor.
    Provide strategic career guidance based on a candidate's profile and job market fit.
    Be specific and actionable."""

    prompt = f"""Provide career advice for this candidate based on their profile and job matches.

CANDIDATE:
Skills: {', '.join(skills)}
Level: {career_signals.seniority_level if career_signals else 'Unknown'}
Experience: {career_signals.years_experience if career_signals else 'Unknown'} years
Trajectory: {career_signals.career_trajectory if career_signals else 'Unknown'}

MATCHED JOBS:
{chr(10).join('- ' + js for js in job_summaries)}

Provide career advice as JSON:
{{
    "recommended_trajectory": "Strategic recommendation for career direction (2-3 sentences)",
    "immediate_opportunities": ["Role type 1 they should pursue", "Role type 2"],
    "skill_investments": ["Skill to develop 1", "Skill 2", "Skill 3"],
    "market_insights": "Brief insight about job market for their profile"
}}

Return ONLY valid JSON."""

    try:
        response = await generate_with_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.3,
            max_tokens=4048,
            task="career_advice",
            log_context="career advice summary based on job matches",
        )
    except Exception as e:
        print(f"[JobMatcher] Error generating career advice: {e}")
        return CareerAdvice(
            recommended_trajectory="Continue building experience in your area of expertise",
            immediate_opportunities=[],
            skill_investments=[],
            market_insights=None,
        )

    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        data = json.loads(cleaned.strip())

        return CareerAdvice(
            recommended_trajectory=data.get(
                "recommended_trajectory", "Continue building experience in your current area"
            ),
            immediate_opportunities=data.get("immediate_opportunities", []),
            skill_investments=data.get("skill_investments", []),
            market_insights=data.get("market_insights"),
        )
    except json.JSONDecodeError:
        return CareerAdvice(
            recommended_trajectory="Continue building experience in your area of expertise",
            immediate_opportunities=[],
            skill_investments=[],
            market_insights=None,
        )


async def match_resume_to_jobs(
    resume_data: ResumeData,
    jobs: list[JobPosting],
    include_trajectory: bool = True,
) -> list[JobMatch]:
    """
    Match a resume against multiple jobs with AI analysis.

    Args:
        resume_data: Parsed resume data
        jobs: List of job postings to analyze
        include_trajectory: Whether to include career trajectory analysis

    Returns:
        List of JobMatch objects sorted by fit score
    """
    
    async def analyze_single_job(job: JobPosting, job_index: int) -> JobMatch:
        """Analyze a single job with error handling."""
        print(f"[JobMatcher] [{job_index + 1}/{len(jobs)}] Starting analysis for '{job.title}' at {job.company}")
        try:
            # Analyze fit
            fit_analysis = await analyze_job_fit(resume_data, job)
            print(f"[JobMatcher] [{job_index + 1}/{len(jobs)}] ✓ Fit analysis complete for '{job.title}' - {fit_analysis.overall_match}% match")
        except Exception as e:
            print(f"[JobMatcher] [{job_index + 1}/{len(jobs)}] ✗ Error analyzing job fit for '{job.title}': {e}")
            # Return default fit analysis on error
            fit_analysis = FitAnalysis(
                overall_match=50,
                skill_match=50,
                experience_match=50,
                culture_signals="Analysis unavailable",
                strengths_for_role=[],
                potential_concerns=["Analysis unavailable"],
                interview_focus_areas=[],
                preparation_priority=[],
                skill_matches=[],
            )

        # Optionally analyze career trajectory
        career_trajectory = None
        if include_trajectory:
            try:
                career_trajectory = await analyze_career_trajectory(resume_data, job)
                print(f"[JobMatcher] [{job_index + 1}/{len(jobs)}] ✓ Career trajectory complete for '{job.title}'")
            except Exception as e:
                print(f"[JobMatcher] [{job_index + 1}/{len(jobs)}] ✗ Error analyzing trajectory for '{job.title}': {e}")
                career_trajectory = CareerTrajectory(
                    current_fit="Analysis unavailable",
                    growth_path=None,
                    adjacent_roles=[],
                    long_term_outlook=None,
                    time_to_next_level=None,
                )

        return JobMatch(
            job=job,
            fit_analysis=fit_analysis,
            career_trajectory=career_trajectory,
            saved=False,
            applied=False,
        )

    # Run all job analyses in parallel
    job_titles = [f"'{j.title}'" for j in jobs]
    print(f"[JobMatcher] Starting parallel analysis for {len(jobs)} jobs: {', '.join(job_titles)}")
    print(f"[JobMatcher] Each job will have: fit analysis + career trajectory analysis")
    matches = await asyncio.gather(*[analyze_single_job(job, idx) for idx, job in enumerate(jobs)])

    # Sort by overall match score
    matches = list(matches)
    matches.sort(key=lambda m: m.fit_analysis.overall_match, reverse=True)

    top_matches = [(m.job.title, m.fit_analysis.overall_match) for m in matches[:3]]
    print(f"[JobMatcher] ✓ All {len(matches)} jobs analyzed. Top matches: {top_matches}")
    return matches


async def generate_interview_prep_plan(
    resume_data: ResumeData,
    job: JobPosting,
) -> InterviewPrepPlan:
    """
    Generate a customized interview preparation plan for a specific job.

    Args:
        resume_data: Parsed resume data
        job: Target job posting

    Returns:
        InterviewPrepPlan with preparation recommendations
    """
    skills = resume_data.skills[:15] if resume_data.skills else []
    star_stories = resume_data.star_stories[:5] if resume_data.star_stories else []

    star_summaries = []
    for story in star_stories:
        star_summaries.append(f"{story.theme}: {story.situation[:50]}...")

    system_instruction = """You are an expert interview coach.
    Create a comprehensive interview preparation plan tailored to a specific job.
    Focus on practical, actionable preparation steps."""

    prompt = f"""Create an interview preparation plan for this candidate and job.

CANDIDATE:
Skills: {', '.join(skills)}
STAR Stories Available: {chr(10).join('- ' + s for s in star_summaries) if star_summaries else 'None prepared'}

JOB:
Title: {job.title}
Company: {job.company}
Requirements: {chr(10).join('- ' + req for req in job.requirements)}

Provide preparation plan as JSON:
{{
    "key_topics": ["Topic 1 to study", "Topic 2", "Topic 3"],
    "likely_questions": [
        {{"question": "Expected question", "type": "behavioral|technical|situational", "how_to_prepare": "Brief prep tip"}}
    ],
    "star_stories_to_use": ["Which of their stories to use and for what"],
    "skills_to_highlight": ["Skill 1", "Skill 2"],
    "gaps_to_address": ["Gap and how to address it in interview"],
    "company_research_points": ["What to research about the company"],
    "questions_to_ask": ["Smart questions to ask the interviewer"]
}}

Return ONLY valid JSON."""

    response = await generate_with_gemini(
        prompt=prompt,
        system_instruction=system_instruction,
        temperature=0.3,
        max_tokens=8048,
        task="job_fit_analysis",
        log_context=f"interview prep plan for '{job.title}' at {job.company}",
    )

    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        data = json.loads(cleaned.strip())

        return InterviewPrepPlan(
            job_id=job.job_id,
            company=job.company,
            role=job.title,
            key_topics=data.get("key_topics", []),
            likely_questions=data.get("likely_questions", []),
            star_stories_to_use=data.get("star_stories_to_use", []),
            skills_to_highlight=data.get("skills_to_highlight", []),
            gaps_to_address=data.get("gaps_to_address", []),
            company_research_points=data.get("company_research_points", []),
            questions_to_ask=data.get("questions_to_ask", []),
        )
    except json.JSONDecodeError:
        return InterviewPrepPlan(
            job_id=job.job_id,
            company=job.company,
            role=job.title,
            key_topics=job.requirements[:3],
            likely_questions=[],
            star_stories_to_use=[],
            skills_to_highlight=skills[:3],
            gaps_to_address=[],
            company_research_points=[f"Research {job.company} mission and values"],
            questions_to_ask=["What does success look like in this role?"],
        )
