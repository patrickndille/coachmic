"""Job board service with mock data for MVP."""

from datetime import datetime, timedelta
from typing import Optional
import random

from app.models.job import (
    JobPosting,
    SalaryRange,
)


# ============================================================================
# MOCK JOB DATA
# ============================================================================

MOCK_COMPANIES = [
    {
        "name": "TechCorp",
        "logo": "https://via.placeholder.com/100x100?text=TC",
        "culture": "Fast-paced startup environment focused on innovation and rapid iteration",
    },
    {
        "name": "CloudScale Inc",
        "logo": "https://via.placeholder.com/100x100?text=CS",
        "culture": "Enterprise company with strong engineering culture and work-life balance",
    },
    {
        "name": "DataFlow Systems",
        "logo": "https://via.placeholder.com/100x100?text=DF",
        "culture": "Data-driven decision making with collaborative team environment",
    },
    {
        "name": "AI Innovations",
        "logo": "https://via.placeholder.com/100x100?text=AI",
        "culture": "Research-focused with cutting-edge ML projects and academic partnerships",
    },
    {
        "name": "FinTech Solutions",
        "logo": "https://via.placeholder.com/100x100?text=FT",
        "culture": "Security-first mindset with strong compliance and regulatory focus",
    },
    {
        "name": "HealthTech Pro",
        "logo": "https://via.placeholder.com/100x100?text=HT",
        "culture": "Mission-driven team improving healthcare outcomes through technology",
    },
    {
        "name": "DevOps Masters",
        "logo": "https://via.placeholder.com/100x100?text=DM",
        "culture": "Infrastructure experts with strong automation and reliability focus",
    },
    {
        "name": "StartupXYZ",
        "logo": "https://via.placeholder.com/100x100?text=XY",
        "culture": "Early-stage startup with equity upside and high growth potential",
    },
]

MOCK_JOBS: list[dict] = [
    # Senior ML Engineer roles
    {
        "job_id": "mock_001",
        "title": "Senior ML Engineer",
        "company_idx": 0,  # TechCorp
        "location": "San Francisco, CA",
        "remote_type": "hybrid",
        "salary_min": 150000,
        "salary_max": 200000,
        "experience_level": "senior",
        "description": "Join our AI team to build production ML systems that power personalized recommendations for millions of users. You'll work on cutting-edge deep learning models and optimize inference pipelines.",
        "requirements": [
            "5+ years of experience in machine learning",
            "Strong Python programming skills",
            "Experience with PyTorch or TensorFlow",
            "Experience deploying ML models to production",
            "Strong understanding of ML fundamentals",
        ],
        "nice_to_have": [
            "Experience with Kubernetes",
            "MLOps experience",
            "Recommendation systems experience",
        ],
        "benefits": [
            "Competitive salary + equity",
            "Health, dental, vision insurance",
            "Unlimited PTO",
            "Remote work flexibility",
        ],
        "keywords": ["python", "machine learning", "pytorch", "tensorflow", "kubernetes", "mlops"],
    },
    {
        "job_id": "mock_002",
        "title": "ML Platform Engineer",
        "company_idx": 1,  # CloudScale Inc
        "location": "Seattle, WA",
        "remote_type": "remote",
        "salary_min": 160000,
        "salary_max": 220000,
        "experience_level": "senior",
        "description": "Build and maintain ML infrastructure serving billions of predictions daily. Design systems for model training, deployment, and monitoring at scale.",
        "requirements": [
            "6+ years in software engineering",
            "3+ years in ML infrastructure",
            "Strong Python and Go skills",
            "Experience with Kubernetes and Docker",
            "Experience with cloud platforms (AWS/GCP/Azure)",
        ],
        "nice_to_have": [
            "Experience with Kubeflow or MLflow",
            "Spark/distributed computing experience",
            "Experience with feature stores",
        ],
        "benefits": [
            "Base + 15% bonus",
            "RSU grants",
            "401k matching",
            "Parental leave",
        ],
        "keywords": ["python", "go", "kubernetes", "mlops", "aws", "gcp", "docker"],
    },
    # Data Engineer roles
    {
        "job_id": "mock_003",
        "title": "Senior Data Engineer",
        "company_idx": 2,  # DataFlow Systems
        "location": "New York, NY",
        "remote_type": "hybrid",
        "salary_min": 140000,
        "salary_max": 180000,
        "experience_level": "senior",
        "description": "Design and build data pipelines processing terabytes of data daily. Work with stakeholders to create reliable, scalable data infrastructure.",
        "requirements": [
            "5+ years of data engineering experience",
            "Strong SQL and Python skills",
            "Experience with Spark, Airflow, or similar",
            "Experience with data warehousing",
            "Strong understanding of data modeling",
        ],
        "nice_to_have": [
            "Experience with real-time streaming (Kafka)",
            "dbt experience",
            "Cloud data platforms (Snowflake, BigQuery)",
        ],
        "benefits": [
            "Competitive salary",
            "Annual bonus",
            "Learning budget",
            "Flexible hours",
        ],
        "keywords": ["python", "sql", "spark", "airflow", "kafka", "data engineering"],
    },
    # Software Engineer roles
    {
        "job_id": "mock_004",
        "title": "Senior Software Engineer - Backend",
        "company_idx": 4,  # FinTech Solutions
        "location": "Chicago, IL",
        "remote_type": "onsite",
        "salary_min": 145000,
        "salary_max": 185000,
        "experience_level": "senior",
        "description": "Build secure, high-performance backend systems for financial transactions. Work on APIs handling millions of requests with strict latency requirements.",
        "requirements": [
            "5+ years backend development",
            "Strong Java or Python experience",
            "Experience with microservices architecture",
            "Understanding of security best practices",
            "Experience with PostgreSQL or similar",
        ],
        "nice_to_have": [
            "Financial services experience",
            "Experience with Kafka",
            "AWS certifications",
        ],
        "benefits": [
            "Competitive base salary",
            "Performance bonus",
            "Stock options",
            "Professional development budget",
        ],
        "keywords": ["java", "python", "microservices", "postgresql", "kafka", "backend"],
    },
    {
        "job_id": "mock_005",
        "title": "Full Stack Engineer",
        "company_idx": 7,  # StartupXYZ
        "location": "Austin, TX",
        "remote_type": "remote",
        "salary_min": 120000,
        "salary_max": 160000,
        "experience_level": "mid",
        "description": "Join our founding engineering team! Build features end-to-end using React and Python. High ownership, high impact role.",
        "requirements": [
            "3+ years of full stack experience",
            "React/TypeScript proficiency",
            "Python backend experience",
            "Comfortable with rapid iteration",
            "Strong communication skills",
        ],
        "nice_to_have": [
            "Startup experience",
            "DevOps skills",
            "Product sense",
        ],
        "benefits": [
            "Significant equity package",
            "Health insurance",
            "Home office setup",
            "Team retreats",
        ],
        "keywords": ["react", "typescript", "python", "fullstack", "startup"],
    },
    # DevOps/Platform roles
    {
        "job_id": "mock_006",
        "title": "Senior DevOps Engineer",
        "company_idx": 6,  # DevOps Masters
        "location": "Denver, CO",
        "remote_type": "remote",
        "salary_min": 140000,
        "salary_max": 180000,
        "experience_level": "senior",
        "description": "Design and implement CI/CD pipelines and infrastructure automation. Lead cloud migration and optimization initiatives.",
        "requirements": [
            "5+ years DevOps/SRE experience",
            "Strong Kubernetes experience",
            "Terraform or Pulumi expertise",
            "CI/CD pipeline design",
            "Monitoring and observability tools",
        ],
        "nice_to_have": [
            "Multi-cloud experience",
            "Security certifications",
            "Team lead experience",
        ],
        "benefits": [
            "Competitive salary",
            "Remote-first culture",
            "Conference budget",
            "Certification support",
        ],
        "keywords": ["kubernetes", "terraform", "devops", "cicd", "aws", "gcp", "docker"],
    },
    # AI/Research roles
    {
        "job_id": "mock_007",
        "title": "Applied AI Scientist",
        "company_idx": 3,  # AI Innovations
        "location": "Boston, MA",
        "remote_type": "hybrid",
        "salary_min": 170000,
        "salary_max": 230000,
        "experience_level": "senior",
        "description": "Research and develop novel AI solutions. Publish papers, build prototypes, and collaborate with product teams to ship AI-powered features.",
        "requirements": [
            "PhD or MS in ML/AI or related field",
            "Publication record in top venues",
            "Strong Python and PyTorch skills",
            "Experience with LLMs and transformers",
            "Ability to translate research to products",
        ],
        "nice_to_have": [
            "Experience with multimodal AI",
            "Reinforcement learning experience",
            "Industry research experience",
        ],
        "benefits": [
            "Research freedom",
            "Conference attendance",
            "Publishing support",
            "Competitive compensation",
        ],
        "keywords": ["python", "pytorch", "llm", "transformers", "research", "ai"],
    },
    # Healthcare tech
    {
        "job_id": "mock_008",
        "title": "Healthcare Data Scientist",
        "company_idx": 5,  # HealthTech Pro
        "location": "Boston, MA",
        "remote_type": "hybrid",
        "salary_min": 130000,
        "salary_max": 170000,
        "experience_level": "mid",
        "description": "Apply ML to improve patient outcomes. Build predictive models for clinical decision support and population health management.",
        "requirements": [
            "3+ years data science experience",
            "Healthcare or biotech experience",
            "Strong Python and SQL skills",
            "Experience with statistical modeling",
            "HIPAA compliance understanding",
        ],
        "nice_to_have": [
            "Clinical data experience (EHR)",
            "FDA software experience",
            "Bioinformatics background",
        ],
        "benefits": [
            "Mission-driven work",
            "Health benefits",
            "Flexible schedule",
            "Growth opportunities",
        ],
        "keywords": ["python", "sql", "healthcare", "data science", "machine learning"],
    },
    # Entry/Junior roles
    {
        "job_id": "mock_009",
        "title": "Software Engineer - New Grad",
        "company_idx": 1,  # CloudScale Inc
        "location": "Seattle, WA",
        "remote_type": "hybrid",
        "salary_min": 100000,
        "salary_max": 130000,
        "experience_level": "entry",
        "description": "Start your career at a leading tech company. Rotational program across backend, frontend, and infrastructure teams.",
        "requirements": [
            "BS/MS in Computer Science or related",
            "Strong programming fundamentals",
            "Internship or project experience",
            "Eagerness to learn",
            "Strong problem-solving skills",
        ],
        "nice_to_have": [
            "Open source contributions",
            "Personal projects",
            "Hackathon experience",
        ],
        "benefits": [
            "Mentorship program",
            "Learning budget",
            "Relocation assistance",
            "Sign-on bonus",
        ],
        "keywords": ["new grad", "entry level", "software engineer", "python", "java"],
    },
    {
        "job_id": "mock_010",
        "title": "Junior Data Analyst",
        "company_idx": 2,  # DataFlow Systems
        "location": "Remote, USA",
        "remote_type": "remote",
        "salary_min": 70000,
        "salary_max": 90000,
        "experience_level": "entry",
        "description": "Join our analytics team to help stakeholders make data-driven decisions. Build dashboards and analyze trends.",
        "requirements": [
            "Bachelor's degree",
            "Strong SQL skills",
            "Experience with data visualization",
            "Attention to detail",
            "Good communication skills",
        ],
        "nice_to_have": [
            "Python or R experience",
            "Tableau or Looker experience",
            "Statistics background",
        ],
        "benefits": [
            "Fully remote",
            "Flexible hours",
            "Growth path to senior roles",
            "Team collaboration",
        ],
        "keywords": ["sql", "data analysis", "tableau", "entry level", "remote"],
    },
]


def _build_job_posting(job_data: dict, days_ago: int) -> JobPosting:
    """Build a JobPosting from mock data."""
    company = MOCK_COMPANIES[job_data["company_idx"]]
    posted_date = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")

    salary_range = None
    if job_data.get("salary_min") and job_data.get("salary_max"):
        salary_range = SalaryRange(
            min_salary=job_data["salary_min"],
            max_salary=job_data["salary_max"],
            currency="USD",
            period="yearly",
        )

    return JobPosting(
        job_id=job_data["job_id"],
        source="mock",
        title=job_data["title"],
        company=company["name"],
        location=job_data["location"],
        remote_type=job_data["remote_type"],
        salary_range=salary_range,
        posted_date=posted_date,
        description=job_data["description"],
        requirements=job_data["requirements"],
        nice_to_have=job_data.get("nice_to_have", []),
        benefits=job_data.get("benefits", []),
        url=f"https://example.com/jobs/{job_data['job_id']}",
        company_logo=company["logo"],
        experience_level=job_data.get("experience_level"),
        employment_type="full-time",
    )


class JobBoardService:
    """Service for searching and retrieving job postings.
    
    Uses JSearch API for real job listings with mock data as fallback.
    """

    def __init__(self):
        # Import JSearch service
        from app.services.jsearch_service import get_jsearch_service
        self._jsearch = get_jsearch_service()
        
        # Build mock jobs with random posting dates (fallback)
        self._jobs: dict[str, JobPosting] = {}
        self._job_keywords: dict[str, list[str]] = {}
        
        # Cache for JSearch jobs (for get_job_by_id)
        self._jsearch_cache: dict[str, JobPosting] = {}

        for i, job_data in enumerate(MOCK_JOBS):
            days_ago = random.randint(1, 30)
            job = _build_job_posting(job_data, days_ago)
            self._jobs[job.job_id] = job
            self._job_keywords[job.job_id] = job_data.get("keywords", [])
        
        print(f"[JobBoard] Initialized with JSearch: {self._jsearch.is_enabled}")

    def get_company_culture(self, company_name: str) -> Optional[str]:
        """Get company culture description."""
        for company in MOCK_COMPANIES:
            if company["name"] == company_name:
                return company["culture"]
        return None
    
    def _cache_jsearch_jobs(self, jobs: list[JobPosting]) -> None:
        """Cache JSearch jobs for later retrieval by ID."""
        for job in jobs:
            self._jsearch_cache[job.job_id] = job

    async def search_jobs(
        self,
        query: Optional[str] = None,
        skills: Optional[list[str]] = None,
        location: Optional[str] = None,
        remote_only: bool = False,
        experience_level: Optional[str] = None,
        salary_min: Optional[int] = None,
        limit: int = 10,
        country: Optional[str] = None,
        date_posted: Optional[str] = None,
        employment_type: Optional[str] = None,
    ) -> list[JobPosting]:
        """
        Search jobs based on various criteria.

        Uses JSearch API first, falls back to mock data if unavailable.

        Args:
            query: Free-text search query
            skills: List of skills to match
            location: Location filter (state/city to append to query)
            remote_only: Only return remote jobs (passed to JSearch API)
            experience_level: Filter by experience level (client-side filter)
            salary_min: Minimum salary filter (client-side filter)
            limit: Maximum results to return
            country: Country code for JSearch (us, ca, etc.)
            date_posted: Date filter for JSearch (all, today, 3days, week, month)
            employment_type: Employment type for JSearch (FULLTIME, PARTTIME, CONTRACT, INTERN)

        Returns:
            List of matching JobPosting objects
        """
        # Try JSearch first if enabled and we have a query
        if self._jsearch.is_enabled:
            # Build search query from provided params
            search_query = query or ""
            if skills and not query:
                search_query = " ".join(skills[:3])

            if search_query:
                print(f"[JobBoard] Searching JSearch: '{search_query}' location='{location}' remote={remote_only} type={employment_type}")
                jobs = await self._jsearch.search(
                    query=search_query,
                    country=country,
                    date_posted=date_posted or "all",
                    limit=limit * 2,  # Get extra for client-side filtering
                    remote_jobs_only=remote_only,
                    employment_type=employment_type,
                    location=location,
                )

                if jobs:
                    # Cache for later retrieval
                    self._cache_jsearch_jobs(jobs)

                    # Apply client-side filters (experience_level and salary_min - not supported by JSearch)
                    filtered = []
                    for job in jobs:
                        # Experience level filter (client-side only)
                        if experience_level and job.experience_level:
                            if job.experience_level != experience_level:
                                continue

                        # Salary filter (client-side only)
                        if salary_min and job.salary_range:
                            if job.salary_range.max_salary and job.salary_range.max_salary < salary_min:
                                continue

                        filtered.append(job)

                    print(f"[JobBoard] JSearch returned {len(jobs)} jobs, {len(filtered)} after filtering")
                    return filtered[:limit]
        
        # Fallback to mock data
        print("[JobBoard] Using mock data fallback")
        return await self._search_mock_jobs(
            query=query,
            skills=skills,
            location=location,
            remote_only=remote_only,
            experience_level=experience_level,
            salary_min=salary_min,
            limit=limit,
        )
    
    async def _search_mock_jobs(
        self,
        query: Optional[str] = None,
        skills: Optional[list[str]] = None,
        location: Optional[str] = None,
        remote_only: bool = False,
        experience_level: Optional[str] = None,
        salary_min: Optional[int] = None,
        limit: int = 10,
    ) -> list[JobPosting]:
        """Search mock jobs (fallback when JSearch is unavailable)."""
        results = []

        for job_id, job in self._jobs.items():
            # Apply filters
            if remote_only and job.remote_type != "remote":
                continue

            if experience_level and job.experience_level != experience_level:
                continue

            if salary_min and job.salary_range:
                if job.salary_range.max_salary and job.salary_range.max_salary < salary_min:
                    continue

            if location:
                location_lower = location.lower()
                if (
                    location_lower not in job.location.lower()
                    and location_lower != "remote"
                ):
                    continue

            # Score based on query and skills match
            score = 0
            keywords = self._job_keywords.get(job_id, [])

            if query:
                query_lower = query.lower()
                if query_lower in job.title.lower():
                    score += 10
                if query_lower in job.description.lower():
                    score += 5
                for keyword in keywords:
                    if query_lower in keyword.lower():
                        score += 3

            if skills:
                skills_lower = [s.lower() for s in skills]
                for skill in skills_lower:
                    if any(skill in kw.lower() for kw in keywords):
                        score += 5
                    if any(skill in req.lower() for req in job.requirements):
                        score += 3

            # If no search criteria, use recency as score
            if not query and not skills:
                score = 1  # Include all, will be sorted by date

            if score > 0 or (not query and not skills):
                results.append((score, job))

        # Sort by score (descending) then by date
        results.sort(key=lambda x: (-x[0], x[1].posted_date), reverse=False)
        results.sort(key=lambda x: x[0], reverse=True)

        return [job for _, job in results[:limit]]

    async def _get_job_from_saved_jobs(self, job_id: str, user_id: str) -> Optional[JobPosting]:
        """Try to find a job in saved_jobs collection (fallback for JSearch jobs not in cache)."""
        try:
            from app.services.firebase_service import get_firestore_client
            db = get_firestore_client()

            doc = db.collection('saved_jobs').document(f"{user_id}_{job_id}").get()
            if doc.exists:
                data = doc.to_dict()
                job_data = data.get('job_data')
                if job_data:
                    # Convert to JobPosting - handle both snake_case and camelCase
                    return JobPosting(
                        job_id=job_data.get('jobId', job_data.get('job_id', job_id)),
                        source=job_data.get('source', 'saved'),
                        title=job_data.get('title', ''),
                        company=job_data.get('company', ''),
                        location=job_data.get('location', ''),
                        remote_type=job_data.get('remoteType', job_data.get('remote_type', 'unknown')),
                        salary_range=SalaryRange(
                            min_salary=job_data.get('salaryRange', {}).get('minSalary', job_data.get('salary_range', {}).get('min_salary')),
                            max_salary=job_data.get('salaryRange', {}).get('maxSalary', job_data.get('salary_range', {}).get('max_salary')),
                            currency=job_data.get('salaryRange', {}).get('currency', 'USD'),
                            period=job_data.get('salaryRange', {}).get('period', 'yearly'),
                        ) if job_data.get('salaryRange') or job_data.get('salary_range') else None,
                        posted_date=job_data.get('postedDate', job_data.get('posted_date', '')),
                        description=job_data.get('description', ''),
                        requirements=job_data.get('requirements', []),
                        nice_to_have=job_data.get('niceToHave', job_data.get('nice_to_have', [])),
                        benefits=job_data.get('benefits', []),
                        url=job_data.get('url'),
                        company_logo=job_data.get('companyLogo', job_data.get('company_logo')),
                        experience_level=job_data.get('experienceLevel', job_data.get('experience_level')),
                        employment_type=job_data.get('employmentType', job_data.get('employment_type')),
                    )
        except Exception as e:
            print(f"[JobBoard] Error checking saved_jobs for {job_id}: {e}")

        return None

    async def get_job_by_id(self, job_id: str, user_id: Optional[str] = None) -> Optional[JobPosting]:
        """Get a specific job by ID.

        Args:
            job_id: The job ID to look up
            user_id: Optional user ID to check their saved_jobs collection

        Returns:
            JobPosting if found, None otherwise
        """
        # Check JSearch cache first
        if job_id in self._jsearch_cache:
            return self._jsearch_cache[job_id]

        # Check mock jobs
        if job_id in self._jobs:
            return self._jobs[job_id]

        # Fallback: Check user's saved_jobs in Firestore
        if user_id:
            saved_job = await self._get_job_from_saved_jobs(job_id, user_id)
            if saved_job:
                # Cache it for future requests
                self._jsearch_cache[job_id] = saved_job
                print(f"[JobBoard] Found job {job_id} in saved_jobs, added to cache")
                return saved_job

        return None

    async def get_recommended_jobs(
        self,
        skills: list[str],
        experience_years: Optional[int] = None,
        preferred_roles: Optional[list[str]] = None,
        limit: int = 5,
        resume_data: Optional["ResumeData"] = None,
        country: Optional[str] = None,
        user_target_role: Optional[str] = None,
    ) -> list[JobPosting]:
        """
        Get AI-recommended jobs based on candidate profile.
        
        Uses JSearch API for real jobs when available with smart query optimization.

        Args:
            skills: Candidate's skills
            experience_years: Years of experience
            preferred_roles: Preferred job titles/roles
            limit: Maximum results
            resume_data: Full resume data for smart search
            country: Country code for job search
            user_target_role: Optional user-specified target role (overrides AI suggestions)

        Returns:
            List of recommended jobs
        """
        # Try JSearch with resume-based smart search and query optimization
        # (now includes automatic fallback to broader queries)
        if self._jsearch.is_enabled and resume_data:
            print("[JobBoard] Using JSearch for recommended jobs with query optimization")
            jobs = await self._jsearch.search_for_resume(
                resume_data=resume_data,
                country=country,
                limit=limit,
                user_target_role=user_target_role,
                use_optimizer=True,
            )
            if jobs:
                self._cache_jsearch_jobs(jobs)
                return jobs
        
        # Try JSearch with simplified broad query (no specific tools)
        if self._jsearch.is_enabled and (skills or preferred_roles):
            # Build a simple, broad query - avoid specific tools/technologies
            query = None
            if preferred_roles:
                # Just use the first role, simplified
                role = preferred_roles[0]
                # Remove parenthetical content and specific tools
                if "(" in role:
                    role = role.split("(")[0].strip()
                # Take just first 2-3 words to keep it broad
                role_words = role.split()[:3]
                query = " ".join(role_words)
            elif skills:
                # Use only broad skill categories, not specific tools
                broad_skills = []
                specific_tools = {"wazuh", "sentinel", "kql", "splunk", "qradar", "kubernetes", "terraform"}
                for skill in skills[:5]:
                    if skill.lower() not in specific_tools:
                        broad_skills.append(skill)
                    if len(broad_skills) >= 2:
                        break
                if broad_skills:
                    query = " ".join(broad_skills[:2])
            
            if query:
                print(f"[JobBoard] JSearch fallback query: '{query}'")
                jobs = await self._jsearch.search(
                    query=query,
                    country=country,
                    limit=limit,
                )
                if jobs:
                    self._cache_jsearch_jobs(jobs)
                    return jobs
        
        # Fallback to mock data
        print("[JobBoard] Using mock data for recommended jobs")
        
        # Determine experience level from years
        experience_level = None
        if experience_years is not None:
            if experience_years < 2:
                experience_level = "entry"
            elif experience_years < 5:
                experience_level = "mid"
            else:
                experience_level = "senior"

        # Search with skills
        jobs = await self._search_mock_jobs(
            skills=skills,
            experience_level=experience_level,
            limit=limit * 2,  # Get more to filter
        )

        # If preferred roles, boost those
        if preferred_roles:
            role_lower = [r.lower() for r in preferred_roles]
            scored = []
            for job in jobs:
                boost = 0
                for role in role_lower:
                    if role in job.title.lower():
                        boost += 10
                scored.append((boost, job))
            scored.sort(key=lambda x: x[0], reverse=True)
            jobs = [job for _, job in scored]

        return jobs[:limit]


# Import for type hints
from app.models.resume import ResumeData

# Singleton instance
_job_board_service: Optional[JobBoardService] = None


def get_job_board_service() -> JobBoardService:
    """Get or create the job board service singleton."""
    global _job_board_service
    if _job_board_service is None:
        _job_board_service = JobBoardService()
    return _job_board_service
