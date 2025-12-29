"""JSearch API integration service for real job listings."""

import asyncio
import hashlib
import json
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx

from app.config import get_settings
from app.models.job import JobPosting, SalaryRange
from app.models.resume import ResumeData
from app.services.search_query_optimizer import get_search_query_optimizer, OptimizedQuery

settings = get_settings()

# ============================================================================
# CACHE FOR API RESPONSES
# ============================================================================

_cache: dict[str, tuple[datetime, Any]] = {}


def _get_cache_key(
    query: str,
    country: str,
    page: int,
    remote_jobs_only: bool = False,
    employment_type: Optional[str] = None,
    location: Optional[str] = None,
) -> str:
    """Generate a cache key for the search parameters."""
    key_str = f"{query}:{country}:{page}:{remote_jobs_only}:{employment_type}:{location}"
    return hashlib.md5(key_str.encode()).hexdigest()


def _get_cached_result(cache_key: str) -> Optional[Any]:
    """Get a cached result if it exists and is not expired."""
    if cache_key in _cache:
        cached_time, data = _cache[cache_key]
        ttl_seconds = settings.jsearch_cache_ttl
        if datetime.now() - cached_time < timedelta(seconds=ttl_seconds):
            print(f"[JSearch] Cache hit for key: {cache_key[:8]}...")
            return data
        else:
            # Expired, remove from cache
            del _cache[cache_key]
    return None


def _set_cached_result(cache_key: str, data: Any) -> None:
    """Store a result in the cache."""
    _cache[cache_key] = (datetime.now(), data)
    print(f"[JSearch] Cached result for key: {cache_key[:8]}...")


# ============================================================================
# JSEARCH API CLIENT
# ============================================================================


async def search_jobs_jsearch(
    query: str,
    country: str = "us",
    date_posted: str = "all",
    page: int = 1,
    num_pages: int = 1,
    remote_jobs_only: bool = False,
    employment_type: Optional[str] = None,
    location: Optional[str] = None,
) -> dict[str, Any]:
    """
    Search for jobs using the JSearch API.

    Args:
        query: Search query (job title, skills, etc.)
        country: Country code (us, ca, uk, etc.)
        date_posted: Date filter (all, today, 3days, week, month)
        page: Page number for pagination
        num_pages: Number of pages to fetch
        remote_jobs_only: Filter to only remote jobs
        employment_type: Filter by employment type (FULLTIME, PARTTIME, CONTRACT, INTERN)
        location: Location to append to query (e.g., "California" or "San Francisco, California")

    Returns:
        Raw API response dictionary
    """
    if not settings.jsearch_api_key:
        print("[JSearch] No API key configured, returning empty results")
        return {"status": "ERROR", "data": [], "message": "No API key configured"}

    # Build the final query - append location if provided
    final_query = query
    if location:
        final_query = f"{query} in {location}"

    # Check cache first
    cache_key = _get_cache_key(final_query, country, page, remote_jobs_only, employment_type, location)
    cached = _get_cached_result(cache_key)
    if cached:
        return cached

    # Build request URL
    base_url = settings.jsearch_api_url
    url = f"{base_url}/search"

    params = {
        "query": final_query,
        "country": country,
        "date_posted": date_posted,
        "page": page,
        "num_pages": num_pages,
    }

    # Add optional filters
    if remote_jobs_only:
        params["remote_jobs_only"] = "true"
    if employment_type:
        params["employment_types"] = employment_type

    headers = {
        "x-api-key": settings.jsearch_api_key,
    }

    print(f"[JSearch] Searching: query='{final_query}', country='{country}', page={page}, remote={remote_jobs_only}, type={employment_type}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()

            # Cache successful response ONLY if it has results
            # Don't cache 0-result searches to allow retries with different queries
            if data.get("status") == "OK":
                job_count = len(data.get("data", []))
                if job_count > 0:
                    _set_cached_result(cache_key, data)
                print(f"[JSearch] Found {job_count} jobs")
            else:
                print(f"[JSearch] API returned status: {data.get('status')}")

            return data

    except httpx.TimeoutException:
        print("[JSearch] API request timed out")
        return {"status": "ERROR", "data": [], "message": "Request timed out"}
    except httpx.HTTPStatusError as e:
        print(f"[JSearch] API error: {e.response.status_code} - {e.response.text}")
        return {"status": "ERROR", "data": [], "message": str(e)}
    except Exception as e:
        print(f"[JSearch] Unexpected error: {e}")
        return {"status": "ERROR", "data": [], "message": str(e)}


# ============================================================================
# JOB TRANSFORMATION
# ============================================================================


def transform_jsearch_job(job_data: dict[str, Any]) -> JobPosting:
    """
    Transform a JSearch job response into our JobPosting model.

    Args:
        job_data: Raw job data from JSearch API

    Returns:
        JobPosting model instance
    """
    # Map employment type
    employment_type_raw = job_data.get("job_employment_type", "Full-time")
    employment_type_map = {
        "Full-time": "full-time",
        "FULLTIME": "full-time",
        "Part-time": "part-time",
        "PARTTIME": "part-time",
        "Contract": "contract",
        "CONTRACTOR": "contract",
        "Intern": "internship",
        "INTERN": "internship",
    }
    employment_type = employment_type_map.get(employment_type_raw, "full-time")

    # Determine remote type
    is_remote = job_data.get("job_is_remote", False)
    job_title_lower = job_data.get("job_title", "").lower()
    job_desc_lower = job_data.get("job_description", "").lower()
    
    if is_remote:
        remote_type = "remote"
    elif "hybrid" in job_title_lower or "hybrid" in job_desc_lower:
        remote_type = "hybrid"
    else:
        remote_type = "onsite"

    # Parse salary
    salary_range = None
    min_salary = job_data.get("job_min_salary")
    max_salary = job_data.get("job_max_salary")
    salary_period = job_data.get("job_salary_period", "yearly")

    if min_salary or max_salary:
        period = "yearly" if salary_period in ["YEAR", "yearly", None] else "hourly"
        salary_range = SalaryRange(
            min_salary=int(min_salary) if min_salary else None,
            max_salary=int(max_salary) if max_salary else None,
            currency="USD",
            period=period,
        )

    # Parse posted date
    posted_at = job_data.get("job_posted_at_datetime_utc")
    if posted_at:
        try:
            # Parse ISO format and convert to simple date
            posted_date = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
            posted_date_str = posted_date.strftime("%Y-%m-%d")
        except (ValueError, AttributeError):
            posted_date_str = datetime.now().strftime("%Y-%m-%d")
    else:
        # Use relative date if available
        relative_date = job_data.get("job_posted_at", "")
        posted_date_str = datetime.now().strftime("%Y-%m-%d")

    # Build location string
    city = job_data.get("job_city", "")
    state = job_data.get("job_state", "")
    country = job_data.get("job_country", "")
    location = job_data.get("job_location", "")
    
    if city and state:
        location = f"{city}, {state}"
    elif location:
        pass  # Use the provided location
    elif country:
        location = country

    # Extract requirements from highlights
    highlights = job_data.get("job_highlights", {})
    qualifications = highlights.get("Qualifications", [])
    responsibilities = highlights.get("Responsibilities", [])
    benefits_raw = highlights.get("Benefits", [])

    # If no highlights, try to extract from description
    requirements = qualifications if qualifications else []
    nice_to_have = []  # JSearch doesn't differentiate, so leave empty
    benefits = benefits_raw if benefits_raw else []

    # Determine experience level from job title or description
    experience_level = None
    title_lower = job_data.get("job_title", "").lower()
    desc_lower = job_data.get("job_description", "").lower()[:500]  # First 500 chars

    if any(kw in title_lower for kw in ["senior", "sr.", "lead", "principal", "staff"]):
        experience_level = "senior"
    elif any(kw in title_lower for kw in ["junior", "jr.", "entry", "associate"]):
        experience_level = "entry"
    elif any(kw in title_lower for kw in ["mid", "intermediate"]):
        experience_level = "mid"
    elif "intern" in title_lower or "co-op" in title_lower:
        experience_level = "entry"
    elif "5+ years" in desc_lower or "7+ years" in desc_lower or "10+ years" in desc_lower:
        experience_level = "senior"
    elif "2+ years" in desc_lower or "3+ years" in desc_lower:
        experience_level = "mid"

    return JobPosting(
        job_id=job_data.get("job_id", ""),
        source="jsearch",
        title=job_data.get("job_title", "Unknown Title"),
        company=job_data.get("employer_name", "Unknown Company"),
        location=location or "Location not specified",
        remote_type=remote_type,
        salary_range=salary_range,
        posted_date=posted_date_str,
        description=job_data.get("job_description", "No description available"),
        requirements=requirements,
        nice_to_have=nice_to_have,
        benefits=benefits,
        url=job_data.get("job_apply_link"),
        company_logo=job_data.get("employer_logo"),
        experience_level=experience_level,
        employment_type=employment_type,
    )


def transform_jobs_batch(jobs_data: list[dict[str, Any]]) -> list[JobPosting]:
    """
    Transform a batch of JSearch jobs into JobPosting models.

    Args:
        jobs_data: List of raw job data from JSearch API

    Returns:
        List of JobPosting models
    """
    jobs = []
    for job_data in jobs_data:
        try:
            job = transform_jsearch_job(job_data)
            jobs.append(job)
        except Exception as e:
            print(f"[JSearch] Error transforming job {job_data.get('job_id', 'unknown')}: {e}")
            continue
    return jobs


# ============================================================================
# SMART SEARCH FROM RESUME
# ============================================================================


def build_search_query_from_resume(resume_data: ResumeData) -> str:
    """
    Build an optimal JSearch query from resume data.

    Strategy:
    1. Primary: Use first suggested role (simplified to core job title)
    2. Keep it simple - don't add too many specific skills
    3. Fallback: Generic query if no data

    Args:
        resume_data: Parsed resume data

    Returns:
        Search query string optimized for job matching (kept simple for broad results)
    """
    # Primary: Use suggested roles (these are AI-suggested job titles)
    if resume_data.suggested_roles:
        # Take the first/primary suggested role and simplify it
        primary_role = resume_data.suggested_roles[0]
        
        # Remove overly specific qualifiers that narrow results too much
        # Just use the core job title
        simplified_role = primary_role
        
        # If role has specific tool names in parentheses, remove them
        if "(" in simplified_role:
            simplified_role = simplified_role.split("(")[0].strip()
        
        print(f"[JSearch] Using role: '{simplified_role}' (from '{primary_role}')")
        return simplified_role

    # Fallback: Use top skill or skills
    if resume_data.skills:
        # Use just the first 1-2 broad skills
        broad_skills = []
        too_specific = {"kql", "wazuh", "sentinel", "splunk", "siem"}
        
        for skill in resume_data.skills[:5]:
            skill_lower = skill.lower()
            # Skip very specific tool names
            if not any(spec in skill_lower for spec in too_specific):
                broad_skills.append(skill)
            if len(broad_skills) >= 2:
                break
        
        if broad_skills:
            query = " ".join(broad_skills[:2])
            print(f"[JSearch] Using skills query: '{query}'")
            return query

    # Ultimate fallback
    print("[JSearch] Using fallback query: 'software engineer'")
    return "software engineer"


def _build_location_string_from_resume(resume_data: ResumeData) -> Optional[str]:
    """
    Build a location string from resume location data for job search.

    Examples:
        - "Windsor, Ontario" (city + state/province)
        - "California" (just state)
        - "Toronto" (just city)
    """
    if not resume_data.location:
        return None

    loc = resume_data.location
    # Handle both Pydantic model and dict formats
    if hasattr(loc, 'city'):
        city = loc.city
        state = loc.state_province
    elif isinstance(loc, dict):
        city = loc.get('city')
        state = loc.get('state_province')
    else:
        return None

    parts = []
    if city:
        parts.append(city)
    if state:
        # Expand common state/province codes to full names for better search results
        STATE_EXPANSIONS = {
            # Canadian provinces
            "ON": "Ontario", "BC": "British Columbia", "AB": "Alberta",
            "QC": "Quebec", "MB": "Manitoba", "SK": "Saskatchewan",
            "NS": "Nova Scotia", "NB": "New Brunswick", "NL": "Newfoundland",
            "PE": "Prince Edward Island", "NT": "Northwest Territories",
            "YT": "Yukon", "NU": "Nunavut",
            # US states (common ones)
            "CA": "California", "NY": "New York", "TX": "Texas",
            "WA": "Washington", "FL": "Florida", "IL": "Illinois",
            "PA": "Pennsylvania", "OH": "Ohio", "GA": "Georgia",
            "NC": "North Carolina", "MI": "Michigan", "NJ": "New Jersey",
            "VA": "Virginia", "MA": "Massachusetts", "AZ": "Arizona",
            "CO": "Colorado", "TN": "Tennessee", "MD": "Maryland",
        }
        expanded_state = STATE_EXPANSIONS.get(state.upper(), state)
        parts.append(expanded_state)

    return ", ".join(parts) if parts else None


async def search_jobs_for_resume(
    resume_data: ResumeData,
    country: str = None,
    limit: int = 10,
    user_target_role: Optional[str] = None,
    use_optimizer: bool = True,
) -> list[JobPosting]:
    """
    Search for jobs tailored to a candidate's resume.

    Args:
        resume_data: Parsed resume data
        country: Country code for job search (if not provided, uses resume location)
        limit: Maximum number of jobs to return
        user_target_role: Optional user-specified target role (overrides AI)
        use_optimizer: Whether to use AI-powered query optimization

    Returns:
        List of JobPosting models matched to the resume
    """
    # Extract location from resume if available
    location_string = _build_location_string_from_resume(resume_data)

    # Use resume country if not specified
    if not country and resume_data.location:
        loc = resume_data.location
        resume_country = loc.country_code if hasattr(loc, 'country_code') else loc.get('country_code') if isinstance(loc, dict) else None
        if resume_country:
            country = resume_country.lower()
            print(f"[JSearch] Using resume location: country={country}, location='{location_string}'")

    # Use default country if still not specified
    if not country:
        country = settings.jsearch_default_country

    # Build list of queries to try (from most specific to most broad)
    queries_to_try = []
    alternatives = []
    
    # Use smart query optimizer for better precision
    if use_optimizer:
        optimizer = get_search_query_optimizer()
        optimized = await optimizer.optimize_search_query(
            resume_data=resume_data,
            user_target_role=user_target_role,
            validate_with_ai=True,
        )
        queries_to_try.append(optimized.query)
        alternatives = optimized.alternatives or []
        print(f"[JSearch] Optimized query: '{optimized.query}' (confidence: {optimized.confidence_score:.2f})")
        if alternatives:
            print(f"[JSearch] Alternative queries: {alternatives[:3]}")
    else:
        # Fallback to legacy query builder
        query = build_search_query_from_resume(resume_data)
        queries_to_try.append(query)
    
    # Add alternative queries for fallback
    queries_to_try.extend(alternatives[:3])
    
    # Add progressively broader fallback queries
    if resume_data.suggested_roles:
        # Simplify the first suggested role (remove parentheses content, specific tools)
        primary_role = resume_data.suggested_roles[0]
        simplified = _simplify_query(primary_role)
        if simplified and simplified not in queries_to_try:
            queries_to_try.append(simplified)
    
    # Add very broad industry-based fallback
    if resume_data.career_signals:
        career_signals = resume_data.career_signals
        industries = None
        if hasattr(career_signals, 'industry_focus'):
            industries = career_signals.industry_focus
        elif isinstance(career_signals, dict):
            industries = career_signals.get('industry_focus', [])
        
        if industries and isinstance(industries, list) and industries:
            broad_query = f"{industries[0]} engineer"
            if broad_query not in queries_to_try:
                queries_to_try.append(broad_query)
    
    # Ultimate fallback query
    if "software engineer" not in queries_to_try:
        queries_to_try.append("software engineer")
    
    # Try each query until we get results
    for query in queries_to_try:
        print(f"[JSearch] Trying query: '{query}'" + (f" in '{location_string}'" if location_string else ""))
        result = await search_jobs_jsearch(
            query=query,
            country=country,
            date_posted="month",  # Last month for fresher results
            page=1,
            location=location_string,  # Use location from resume if available
        )

        if result.get("status") != "OK":
            print(f"[JSearch] Search failed: {result.get('message', 'Unknown error')}")
            continue

        # Transform results
        jobs_data = result.get("data", [])
        if jobs_data:
            jobs = transform_jobs_batch(jobs_data)
            print(f"[JSearch] Found {len(jobs)} jobs with query: '{query}'")
            return jobs[:limit]
        else:
            print(f"[JSearch] No results for query: '{query}', trying next...")
    
    # All queries exhausted
    print("[JSearch] All queries returned 0 results")
    return []


def _simplify_query(query: str) -> str:
    """
    Simplify a job search query by removing overly specific terms.
    
    Examples:
        'Senior Wazuh Microsoft Sentinel (KQL)' -> 'Senior Security Engineer'
        'Cybersecurity Engineer Wazuh Microsoft Sentinel' -> 'Cybersecurity Engineer'
    """
    # Remove parenthetical content
    if "(" in query:
        query = query.split("(")[0].strip()
    
    # Specific tools/technologies to remove (they narrow results too much)
    specific_terms = [
        "wazuh", "sentinel", "kql", "splunk", "qradar", "siem", "soar",
        "kubernetes", "k8s", "terraform", "ansible", "jenkins",
        "pytorch", "tensorflow", "kafka", "elasticsearch",
        "azure", "aws", "gcp", "oracle", "ibm"
    ]
    
    words = query.split()
    filtered_words = []
    for word in words:
        word_lower = word.lower().strip("(),.-")
        if word_lower not in specific_terms:
            filtered_words.append(word)
    
    result = " ".join(filtered_words).strip()
    
    # If we stripped everything meaningful, return a generic version
    if len(result) < 5:
        # Try to extract just the role type
        query_lower = query.lower()
        if "security" in query_lower or "cybersecurity" in query_lower:
            return "Cybersecurity Engineer"
        elif "devops" in query_lower or "sre" in query_lower:
            return "DevOps Engineer"
        elif "data" in query_lower:
            return "Data Engineer"
        elif "cloud" in query_lower:
            return "Cloud Engineer"
        else:
            return "Software Engineer"
    
    return result


# ============================================================================
# SINGLETON SERVICE
# ============================================================================


class JSearchService:
    """Service for searching real jobs via JSearch API."""

    def __init__(self):
        self._enabled = bool(settings.jsearch_api_key)
        if self._enabled:
            print("[JSearch] Service initialized with API key")
        else:
            print("[JSearch] Service disabled - no API key configured")

    @property
    def is_enabled(self) -> bool:
        """Check if JSearch is enabled (has API key)."""
        return self._enabled

    async def search(
        self,
        query: str,
        country: str = None,
        date_posted: str = "all",
        limit: int = 10,
        remote_jobs_only: bool = False,
        employment_type: Optional[str] = None,
        location: Optional[str] = None,
    ) -> list[JobPosting]:
        """
        Search for jobs with a text query.

        Args:
            query: Search query
            country: Country code
            date_posted: Date filter
            limit: Maximum results
            remote_jobs_only: Filter to only remote jobs
            employment_type: Filter by employment type (FULLTIME, PARTTIME, CONTRACT, INTERN)
            location: Location to append to query

        Returns:
            List of JobPosting models
        """
        if not self._enabled:
            return []

        country = country or settings.jsearch_default_country
        result = await search_jobs_jsearch(
            query=query,
            country=country,
            date_posted=date_posted,
            remote_jobs_only=remote_jobs_only,
            employment_type=employment_type,
            location=location,
        )

        if result.get("status") != "OK":
            return []

        jobs = transform_jobs_batch(result.get("data", []))
        return jobs[:limit]

    async def search_for_resume(
        self,
        resume_data: ResumeData,
        country: str = None,
        limit: int = 10,
        user_target_role: Optional[str] = None,
        use_optimizer: bool = True,
    ) -> list[JobPosting]:
        """
        Search for jobs tailored to a resume.

        Args:
            resume_data: Parsed resume data
            country: Country code
            limit: Maximum results
            user_target_role: Optional user-specified target role
            use_optimizer: Whether to use AI-powered query optimization

        Returns:
            List of JobPosting models
        """
        if not self._enabled:
            return []

        return await search_jobs_for_resume(
            resume_data=resume_data,
            country=country,
            limit=limit,
            user_target_role=user_target_role,
            use_optimizer=use_optimizer,
        )

    def clear_cache(self) -> None:
        """Clear the search cache."""
        global _cache
        _cache = {}
        print("[JSearch] Cache cleared")


# Singleton instance
_jsearch_service: Optional[JSearchService] = None


def get_jsearch_service() -> JSearchService:
    """Get or create the JSearch service singleton."""
    global _jsearch_service
    if _jsearch_service is None:
        _jsearch_service = JSearchService()
    return _jsearch_service
