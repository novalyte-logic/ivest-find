import { Investor } from '../data/investors';

export function getInvestorIdentityKey(investor: Investor): string {
  return (
    investor.linkedinUrl?.trim().toLowerCase() ||
    [
      investor.name.trim().toLowerCase(),
      (investor.firm || '').trim().toLowerCase(),
      investor.location.trim().toLowerCase(),
    ].join('::')
  );
}

export function dedupeInvestors(investors: Investor[]): Investor[] {
  const seen = new Set<string>();

  return investors.filter((investor) => {
    const key = getInvestorIdentityKey(investor);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
