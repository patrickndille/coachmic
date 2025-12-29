"""Smart Search Query Optimization Service for precise job matching."""

import asyncio
import json
from dataclasses import dataclass
from typing import Optional

from app.models.resume import ResumeData
from app.services.gemini_service import generate_with_gemini


@dataclass
class QueryCandidate:
    """A candidate search query with metadata."""
    query: str
    source: str  # 'suggested_role', 'skills', 'ai_generated', 'user_override'
    confidence: float  # 0.0 - 1.0
    reasoning: str


@dataclass 
class OptimizedQuery:
    """The result of query optimization."""
    query: str
    alternatives: list[str]
    confidence_score: float
    optimization_notes: str
    used_user_preference: bool


class SearchQueryOptimizer:
    """
    Optimizes job search queries for maximum relevance and precision.
    
    Uses AI to validate and score candidate queries against resume data,
    ensuring the best possible match between user profile and job search results.
    """
    
    def __init__(self):
        self._cache: dict[str, OptimizedQuery] = {}
    
    def _get_cache_key(self, resume_data: ResumeData, user_target_role: Optional[str]) -> str:
        """Generate a cache key from resume data and preferences."""
        # Use skills and suggested roles as cache key components
        skills_key = ",".join(sorted(resume_data.skills[:5])) if resume_data.skills else ""
        roles_key = ",".join(resume_data.suggested_roles[:3]) if resume_data.suggested_roles else ""
        user_key = user_target_role or ""
        return f"{skills_key}|{roles_key}|{user_key}"
    
    def _generate_query_candidates(
        self,
        resume_data: ResumeData,
        user_target_role: Optional[str] = None,
    ) -> list[QueryCandidate]:
        """
        Generate multiple candidate search queries from resume data.
        
        Strategy:
        1. User override has highest priority
        2. Suggested roles from resume parsing
        3. Skill-based queries
        4. Experience-level + industry combinations
        """
        candidates = []
        
        # Priority 1: User-specified target role (highest confidence)
        if user_target_role:
            candidates.append(QueryCandidate(
                query=user_target_role.strip(),
                source="user_override",
                confidence=0.95,
                reasoning="User explicitly specified this target role"
            ))
        
        # Priority 2: Suggested roles from resume parsing
        if resume_data.suggested_roles:
            for i, role in enumerate(resume_data.suggested_roles[:3]):
                # First role gets higher confidence
                conf = 0.85 - (i * 0.1)
                candidates.append(QueryCandidate(
                    query=role.strip(),
                    source="suggested_role",
                    confidence=conf,
                    reasoning=f"AI-suggested role #{i+1} from resume analysis"
                ))
        
        # Priority 3: Skill-based queries (combine top skills with career signals)
        if resume_data.skills and len(resume_data.skills) >= 2:
            # Get career signals for context
            career_signals = resume_data.career_signals
            seniority = None
            if career_signals:
                if hasattr(career_signals, 'seniority_level'):
                    seniority = career_signals.seniority_level
                elif isinstance(career_signals, dict):
                    seniority = career_signals.get('seniority_level')
            
            # Build skill-based query with seniority prefix
            top_skills = resume_data.skills[:3]
            skill_query = " ".join(top_skills[:2])
            
            if seniority and seniority in ['senior', 'lead', 'principal']:
                skill_query = f"Senior {skill_query}"
            
            candidates.append(QueryCandidate(
                query=skill_query,
                source="skills",
                confidence=0.65,
                reasoning=f"Derived from top skills: {', '.join(top_skills)}"
            ))
        
        # Priority 4: Industry + role combination
        if resume_data.career_signals:
            career_signals = resume_data.career_signals
            industries = None
            if hasattr(career_signals, 'industry_focus'):
                industries = career_signals.industry_focus
            elif isinstance(career_signals, dict):
                industries = career_signals.get('industry_focus', [])
            
            if industries and resume_data.suggested_roles:
                # Combine first industry with first role
                industry = industries[0] if isinstance(industries, list) else str(industries)
                role = resume_data.suggested_roles[0]
                industry_query = f"{industry} {role}"
                candidates.append(QueryCandidate(
                    query=industry_query,
                    source="industry_role",
                    confidence=0.60,
                    reasoning=f"Industry-specific search: {industry}"
                ))
        
        # Fallback: Generic query based on experience
        if not candidates:
            candidates.append(QueryCandidate(
                query="software engineer",
                source="fallback",
                confidence=0.30,
                reasoning="Fallback query - insufficient resume data"
            ))
        
        return candidates
    
    async def _validate_and_score_queries(
        self,
        candidates: list[QueryCandidate],
        resume_data: ResumeData,
    ) -> list[tuple[QueryCandidate, float]]:
        """
        Use AI to validate and score each candidate query for relevance.
        
        Returns candidates with their AI-validated scores.
        """
        if not candidates:
            return []
        
        # Build resume profile summary for validation
        skills = resume_data.skills[:10] if resume_data.skills else []
        experience_summary = []
        for exp in (resume_data.experience or [])[:3]:
            if isinstance(exp, dict):
                exp_str = f"{exp.get('title', 'Role')} at {exp.get('company', 'Company')}"
                experience_summary.append(exp_str)
        
        # Get career signals
        career_signals = resume_data.career_signals
        seniority = "unknown"
        years_exp = "unknown"
        if career_signals:
            if hasattr(career_signals, 'seniority_level'):
                seniority = career_signals.seniority_level or "unknown"
                years_exp = getattr(career_signals, 'years_experience', "unknown")
            elif isinstance(career_signals, dict):
                seniority = career_signals.get('seniority_level', 'unknown')
                years_exp = career_signals.get('years_experience', 'unknown')
        
        # Build query list for validation
        query_list = "\n".join([
            f"{i+1}. \"{c.query}\""
            for i, c in enumerate(candidates)
        ])
        
        system_instruction = """You are a job search query optimizer. Score queries briefly."""
        
        prompt = f"""Score these job search queries for this candidate:

PROFILE: {seniority} level, {years_exp} years exp
SKILLS: {', '.join(skills[:5])}
ROLES: {', '.join(resume_data.suggested_roles[:2]) if resume_data.suggested_roles else 'N/A'}

QUERIES:
{query_list}

Return compact JSON:
{{"scores":[0.85,0.72,0.65],"best":0,"reason":"brief reason","alts":["alt query 1","alt query 2"]}}

Where "scores" are overall scores (0-1) for each query in order, "best" is the index of best query, "reason" is a brief explanation, and "alts" are 2 alternative query suggestions.

Return ONLY valid JSON."""

        try:
            response = await generate_with_gemini(
                prompt=prompt,
                system_instruction=system_instruction,
                temperature=0.2,
                max_tokens=4048,
                task="query_optimization",
                log_context="validating and scoring job search queries",
            )
            
            # Parse response
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            
            data = json.loads(cleaned.strip())
            
            # Handle compact format: {"scores":[0.85,0.72],"best":0,"reason":"...","alts":["..."]}
            scores = data.get("scores", [])
            best_idx = data.get("best", 0)
            reasoning = data.get("reason", "")
            alternatives = data.get("alts", [])
            
            # Map scores to candidates
            scored_candidates = []
            for i, candidate in enumerate(candidates):
                if i < len(scores):
                    score = float(scores[i])
                else:
                    score = candidate.confidence
                scored_candidates.append((candidate, score))
            
            # Log optimization results
            if best_idx < len(candidates):
                print(f"[QueryOptimizer] AI selected best query: '{candidates[best_idx].query}'")
                print(f"[QueryOptimizer] Reasoning: {reasoning}")
            
            # Store alternatives for later use
            self._last_alternatives = alternatives
            self._last_reasoning = reasoning
            
            return scored_candidates
            
        except Exception as e:
            print(f"[QueryOptimizer] AI validation failed: {e}, using initial confidence scores")
            # Fallback to initial confidence scores
            return [(c, c.confidence) for c in candidates]
    
    async def optimize_search_query(
        self,
        resume_data: ResumeData,
        user_target_role: Optional[str] = None,
        validate_with_ai: bool = True,
    ) -> OptimizedQuery:
        """
        Generate the optimal job search query for a candidate.
        
        Args:
            resume_data: Parsed resume data
            user_target_role: Optional user-specified target role (overrides AI suggestions)
            validate_with_ai: Whether to use AI validation (set False for faster results)
        
        Returns:
            OptimizedQuery with the best query and alternatives
        """
        # Check cache first
        cache_key = self._get_cache_key(resume_data, user_target_role)
        if cache_key in self._cache:
            print(f"[QueryOptimizer] Using cached query")
            return self._cache[cache_key]
        
        # Generate candidate queries
        candidates = self._generate_query_candidates(resume_data, user_target_role)
        print(f"[QueryOptimizer] Generated {len(candidates)} candidate queries")
        
        # Validate and score with AI
        if validate_with_ai and len(candidates) > 1:
            scored_candidates = await self._validate_and_score_queries(candidates, resume_data)
        else:
            # Use initial confidence scores
            scored_candidates = [(c, c.confidence) for c in candidates]
        
        # Sort by score (highest first)
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        
        # Select best query
        best_candidate, best_score = scored_candidates[0]
        
        # Get alternatives (remaining candidates)
        alternatives = [c.query for c, _ in scored_candidates[1:4]]
        
        # Add AI-suggested alternatives if available
        if hasattr(self, '_last_alternatives') and self._last_alternatives:
            for alt in self._last_alternatives:
                if alt not in alternatives and alt != best_candidate.query:
                    alternatives.append(alt)
        
        # Build optimization notes
        notes = f"Selected '{best_candidate.query}' from {best_candidate.source}"
        if hasattr(self, '_last_reasoning') and self._last_reasoning:
            notes += f". {self._last_reasoning}"
        
        result = OptimizedQuery(
            query=best_candidate.query,
            alternatives=alternatives[:5],
            confidence_score=best_score,
            optimization_notes=notes,
            used_user_preference=user_target_role is not None,
        )
        
        # Cache result
        self._cache[cache_key] = result
        
        print(f"[QueryOptimizer] Optimized query: '{result.query}' (confidence: {result.confidence_score:.2f})")
        print(f"[QueryOptimizer] Alternatives: {result.alternatives}")
        
        return result
    
    def clear_cache(self) -> None:
        """Clear the optimization cache."""
        self._cache = {}
        print("[QueryOptimizer] Cache cleared")


# Singleton instance
_optimizer: Optional[SearchQueryOptimizer] = None


def get_search_query_optimizer() -> SearchQueryOptimizer:
    """Get or create the SearchQueryOptimizer singleton."""
    global _optimizer
    if _optimizer is None:
        _optimizer = SearchQueryOptimizer()
        print("[QueryOptimizer] Service initialized")
    return _optimizer
