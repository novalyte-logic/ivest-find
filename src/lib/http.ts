export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();

  if (!contentType.toLowerCase().includes('application/json')) {
    const preview = rawBody.slice(0, 160).trim() || 'Empty response body';
    throw new Error(
      `Expected JSON response but received ${contentType || 'unknown content type'}: ${preview}`,
    );
  }

  let parsed: T;

  try {
    parsed = JSON.parse(rawBody) as T;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to parse JSON response.',
    );
  }

  if (!response.ok) {
    const errorMessage =
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof parsed.error === 'string'
        ? parsed.error
        : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  return parsed;
}
