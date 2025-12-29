/**
 * Artifact Generation Service
 *
 * Handles background generation of cover letters and company intel.
 * Uses fire-and-forget pattern for non-blocking operations.
 */

import { JobPosting, CompanyIntel } from '../types';
import {
  generateCoverLetterStream,
  generateCompanyIntel,
  getSavedJob,
  GenerateCoverLetterRequest,
} from './api';

export interface ArtifactGenerationOptions {
  coverLetter?: boolean;
  companyIntel?: boolean;
  resumeMarkdown?: string;
  targetRole?: string;
  targetCompany?: string;
  jobData?: JobPosting;
}

export interface ArtifactStatus {
  hasCoverLetter: boolean;
  hasCompanyIntel: boolean;
  coverLetter?: string;
  companyIntel?: CompanyIntel;
}

/**
 * Trigger background generation of cover letter and/or company intel for a saved job.
 * Non-blocking - returns immediately, generation happens async.
 *
 * @param jobId - The job ID to generate artifacts for
 * @param options - What to generate and context data
 */
export async function triggerArtifactGeneration(
  jobId: string,
  options: ArtifactGenerationOptions
): Promise<void> {
  const {
    coverLetter = true,
    companyIntel = true,
    resumeMarkdown,
    targetRole,
    targetCompany,
    jobData,
  } = options;

  console.log(`[Artifacts] Triggering generation for job ${jobId}`, {
    coverLetter,
    companyIntel,
    hasResume: !!resumeMarkdown,
    hasJobData: !!jobData,
  });

  const promises: Promise<void>[] = [];

  // Generate cover letter in background
  if (coverLetter && resumeMarkdown && jobData) {
    promises.push(
      generateCoverLetterInBackground(jobId, {
        jobData,
        resumeMarkdown,
        targetRole,
        targetCompany,
      })
    );
  }

  // Generate company intel in background
  if (companyIntel && targetCompany) {
    promises.push(
      generateCompanyIntelInBackground(jobId, targetCompany, targetRole)
    );
  }

  // Fire and forget - don't await
  Promise.allSettled(promises).then((results) => {
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    console.log(`[Artifacts] Generation complete: ${succeeded} succeeded, ${failed} failed`);
  });
}

/**
 * Generate cover letter in background using streaming.
 * Results are saved to saved_jobs collection via the API.
 */
async function generateCoverLetterInBackground(
  jobId: string,
  request: GenerateCoverLetterRequest
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[Artifacts] Starting background cover letter generation for job ${jobId}`);

    generateCoverLetterStream(
      jobId,
      request,
      // onChunk - just log progress
      () => {},
      // onComplete
      (fullText) => {
        console.log(`[Artifacts] Cover letter generated for job ${jobId}: ${fullText.length} chars`);
        resolve();
      },
      // onError
      (error) => {
        console.error(`[Artifacts] Cover letter generation failed for job ${jobId}:`, error);
        reject(new Error(error));
      }
    );
  });
}

/**
 * Generate company intel in background.
 * Results are saved to saved_jobs collection via the API.
 */
async function generateCompanyIntelInBackground(
  jobId: string,
  companyName: string,
  targetRole?: string
): Promise<void> {
  try {
    console.log(`[Artifacts] Starting background company intel generation for ${companyName}`);

    await generateCompanyIntel(
      {
        companyName,
        targetRole,
        jobId,
        includeQuestions: true,
        includeStoryMapping: true,
      },
      jobId
    );

    console.log(`[Artifacts] Company intel generated for ${companyName}`);
  } catch (error) {
    console.error(`[Artifacts] Company intel generation failed for ${companyName}:`, error);
    throw error;
  }
}

/**
 * Check if artifacts exist for a saved job.
 *
 * @param jobId - The job ID to check
 * @returns Artifact status with optional data
 */
export async function getArtifactStatus(jobId: string): Promise<ArtifactStatus> {
  try {
    const savedJob = await getSavedJob(jobId);

    if (!savedJob) {
      return {
        hasCoverLetter: false,
        hasCompanyIntel: false,
      };
    }

    return {
      hasCoverLetter: !!savedJob.coverLetter,
      hasCompanyIntel: !!savedJob.companyIntel,
      coverLetter: savedJob.coverLetter,
      companyIntel: savedJob.companyIntel,
    };
  } catch (error) {
    console.error(`[Artifacts] Failed to get artifact status for job ${jobId}:`, error);
    return {
      hasCoverLetter: false,
      hasCompanyIntel: false,
    };
  }
}

/**
 * Check if a job needs artifact generation.
 * Returns true if either cover letter or company intel is missing.
 */
export function needsArtifactGeneration(
  coverLetter?: string,
  companyIntel?: CompanyIntel
): boolean {
  return !coverLetter || !companyIntel;
}

/**
 * Trigger artifact generation for session (non-saved job).
 * Stores artifacts in session instead of saved_jobs.
 *
 * @param sessionArtifactHandler - Callback to handle generated artifacts
 * @param options - Generation options
 */
export async function triggerSessionArtifactGeneration(
  options: ArtifactGenerationOptions,
  onCoverLetterGenerated?: (coverLetter: string) => void,
  onCompanyIntelGenerated?: (intel: CompanyIntel) => void
): Promise<void> {
  const {
    coverLetter = true,
    companyIntel = true,
    resumeMarkdown,
    targetRole,
    targetCompany,
    jobData,
  } = options;

  console.log(`[Artifacts] Triggering session artifact generation`, {
    coverLetter,
    companyIntel,
    hasResume: !!resumeMarkdown,
    hasJobData: !!jobData,
  });

  const promises: Promise<void>[] = [];

  // Generate cover letter for session
  if (coverLetter && resumeMarkdown && jobData && targetCompany) {
    promises.push(
      new Promise((resolve, reject) => {
        generateCoverLetterStream(
          'session', // Special ID for session-based generation
          {
            jobData,
            resumeMarkdown,
            targetRole,
            targetCompany,
          },
          () => {},
          (fullText) => {
            onCoverLetterGenerated?.(fullText);
            resolve();
          },
          (error) => {
            console.error('[Artifacts] Session cover letter generation failed:', error);
            reject(new Error(error));
          }
        );
      })
    );
  }

  // Generate company intel for session
  if (companyIntel && targetCompany) {
    promises.push(
      (async () => {
        try {
          const response = await generateCompanyIntel({
            companyName: targetCompany,
            targetRole,
            includeQuestions: true,
            includeStoryMapping: true,
          });

          if (response.intel) {
            onCompanyIntelGenerated?.(response.intel);
          }
        } catch (error) {
          console.error('[Artifacts] Session company intel generation failed:', error);
          throw error;
        }
      })()
    );
  }

  // Fire and forget
  Promise.allSettled(promises).then((results) => {
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    console.log(`[Artifacts] Session generation complete: ${succeeded} succeeded, ${failed} failed`);
  });
}
