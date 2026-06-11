export function isAllowedDomainDependency(
  allowedDomainDependencies: Record<string, string[]>,
  sourceDomain: string,
  targetDomain: string,
): boolean {
  const directTargets = allowedDomainDependencies[sourceDomain];
  if (
    directTargets &&
    (directTargets.includes(targetDomain) || directTargets.includes('*'))
  ) {
    return true;
  }

  const wildcardTargets = allowedDomainDependencies['*'];
  if (
    wildcardTargets &&
    (wildcardTargets.includes(targetDomain) || wildcardTargets.includes('*'))
  ) {
    return true;
  }

  return false;
}
