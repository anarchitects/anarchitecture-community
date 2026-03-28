describe('package entrypoint', () => {
  it('loads without exposing the adapter contract yet', async () => {
    const entrypoint = await import('./index.js');

    expect(entrypoint).toBeDefined();
    expect(Object.keys(entrypoint)).toHaveLength(0);
  });
});
