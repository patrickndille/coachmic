/**
 * Tests for API service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockSessionData } from '../../test/mocks';

// Mock axios before importing anything else
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };
  return {
    default: {
      ...mockAxiosInstance,
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

import axios from 'axios';
import * as apiService from '../api';

const mockedAxios = vi.mocked(axios);

describe('API Service', () => {
  // Get the mock axios instance that axios.create() returns
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // axios.create returns the mock instance
    mockAxiosInstance = (mockedAxios.create as any)();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Session Management', () => {
    it('creates a session successfully', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockSessionData });

      const result = await apiService.createSession({
        targetRole: 'Backend Developer',
        targetCompany: 'Google',
        interviewType: 'behavioral',
      });

      expect(result).toEqual(mockSessionData);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/session',
        {
          targetRole: 'Backend Developer',
          targetCompany: 'Google',
          interviewType: 'behavioral',
        }
      );
    });
  });

  describe('Error Handling', () => {
    it('handles network errors', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        apiService.createSession({
          targetRole: 'Developer',
          targetCompany: 'Company',
          interviewType: 'technical',
        })
      ).rejects.toThrow('Network error');
    });
  });
});
