"""Cover Letter Generation Service using Gemini AI with Real Streaming."""

from typing import Optional, AsyncGenerator

from app.models.job import JobPosting
from app.services.gemini_service import generate_with_gemini, get_model_for_task


async def generate_cover_letter_stream(
    job: JobPosting,
    resume_markdown: str,
    target_role: Optional[str] = None,
    target_company: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Generate a personalized cover letter using AI with real streaming.

    This is an async generator that yields text chunks as they are generated.

    Args:
        job: The job posting data
        resume_markdown: The user's improved resume in markdown format
        target_role: Optional role context from setup
        target_company: Optional company context from setup

    Yields:
        Text chunks as they are generated
    """

    system_instruction = """You are an expert career coach, hiring manager, and professional cover letter writer.
    Your job is to analyze a candidate's resume and a specific job description, then produce a
    high-impact, fully personalized cover letter that is ready for submission.

    Your priorities:
    1. Understand the candidate's background, strengths, and achievements from the resume.
    2. Understand the employer's needs, priorities, and required skills from the job description.
    3. Craft a compelling narrative that positions the candidate as an excellent fit.

    COVER LETTER REQUIREMENTS:
    1. Length: 2-3 paragraphs, under 300 words.
    2. Voice: First-person, confident, warm, and professional.
    3. Opening: Strong hook showing genuine interest in the role and company.
    4. Alignment: Highlight 2-3 achievements from the resume that directly match the job requirements.
    5. Company Insight: Demonstrate understanding of the company's mission, product, culture, or challenges.
    6. Tone: Confident but not arrogant; specific but not overly detailed; authentic and human.
    7. Closing: Clear call to action expressing enthusiasm for next steps.
    8. Avoid: Generic phrases, clichés, buzzwords, or repeating the resume.

    FORMAT RULES:
    - Do NOT include date, addresses, or greeting lines (e.g., "Dear Hiring Manager").
    - Do NOT include a signature block (e.g., "Sincerely, [Name]").
    - Only output the body paragraphs of the cover letter.

    INPUTS YOU WILL RECEIVE:
    - resume_text: The candidate's full resume.
    - job_description: The job posting text.
    - job_title: The title of the job.
    - job_requirements: Key requirements or qualifications for the job (if available).
    - company_name: The employer's name (if available).
    - candidate_resume: The candidate's resume.

    OUTPUT:
    - A polished, print-ready cover letter body tailored specifically to the job and resume.
    - Every sentence must be unique to this candidate and this job."""

    # Format requirements if available
    requirements_text = ""
    if job.requirements:
        if isinstance(job.requirements, list):
            requirements_text = "\n".join(f"- {req}" for req in job.requirements[:10])
        else:
            requirements_text = str(job.requirements)

    prompt = f"""Create a professional cover letter for the following job application.

    JOB DETAILS:
    - job_title: {job.title}
    - company_name: {job.company}
    - job_description: {job.description if job.description else 'No description provided'}

    - job_requirements: {requirements_text if requirements_text else 'Not specified'}

    - candidate_resume: {resume_markdown}


    Remember: Only output the cover letter body paragraphs. No headers, dates, addresses, or signatures."""

    model_name = get_model_for_task("cover_letter")
    print(f"[CoverLetter Stream] Starting streaming generation with {model_name}")

    # Use generate_with_gemini with stream=True
    full_prompt = f"{system_instruction}\n\n{prompt}"

    stream_generator = await generate_with_gemini(
        prompt=full_prompt,
        temperature=0.6,
        max_tokens=4096,
        task="cover_letter",
        stream=True,
    )

    chunk_count = 0
    async for chunk in stream_generator:
        chunk_count += 1
        yield chunk

    print(f"[CoverLetter Stream] Completed with {chunk_count} chunks")
