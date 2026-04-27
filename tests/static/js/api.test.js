/**
 * @jest-environment jsdom
 */

import { apiGet, apiPost } from '../../../static/js/api.js';

describe('API Module', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('apiGet', () => {
    test('should make GET request to provided URL', async () => {
      const mockData = { data: 'test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockData))
      });

      await apiGet('/api/test');

      expect(fetch).toHaveBeenCalledWith('/api/test');
    });

    test('should return parsed JSON response', async () => {
      const mockData = { result: 'success' };
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockData))
      });

      const result = await apiGet('/api/test');

      expect(result).toEqual(mockData);
    });

    test('should throw error on non-ok response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(apiGet('/api/notfound')).rejects.toThrow('GET /api/notfound failed');
    });

    test('should handle empty response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('')
      });

      // Empty string will cause JSON.parse to fail
      await expect(apiGet('/api/empty')).rejects.toThrow();
    });

    test('should handle complex JSON response', async () => {
      const mockData = {
        nested: { key: 'value' },
        array: [1, 2, 3],
        number: 42,
        boolean: true,
        null: null
      };
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockData))
      });

      const result = await apiGet('/api/complex');

      expect(result).toEqual(mockData);
    });
  });

  describe('apiPost', () => {
    test('should make POST request with correct options', async () => {
      const mockData = { result: 'success' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      });

      const body = { name: 'test', value: 123 };
      await apiPost('/api/test', body);

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    });

    test('should return parsed JSON response', async () => {
      const mockData = { id: '123', status: 'created' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      });

      const result = await apiPost('/api/create', { data: 'test' });

      expect(result).toEqual(mockData);
    });

    test('should throw error with payload on non-ok response', async () => {
      const errorPayload = { error: 'Validation failed' };
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorPayload)
      });

      try {
        await apiPost('/api/create', { invalid: 'data' });
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBe('Validation failed');
        expect(error.status).toBe(400);
        expect(error.payload).toEqual(errorPayload);
      }
    });

    test('should use default error message when no error in payload', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(apiPost('/api/error', {})).rejects.toThrow('POST /api/error failed');
    });

    test('should handle null body', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      await apiPost('/api/test', null);

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null'
      });
    });

    test('should handle empty object body', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await apiPost('/api/test', {});

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
    });
  });
});
