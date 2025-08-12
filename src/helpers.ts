import { TeamSeason } from './types';

/**
 * Sorts teams by season in chronological order
 * @param teams Array of TeamSeason objects to sort
 * @returns Sorted array of teams (oldest to newest)
 */
export function sortTeamsBySeason(teams: TeamSeason[]): TeamSeason[] {
  return teams.sort((a, b) => {
    // First compare by season year
    if (a.seasonYear !== b.seasonYear) {
      return a.seasonYear - b.seasonYear;
    }
    
    // If same year, sort by season order (Spring, Summer, Fall, Winter)
    const seasonOrder = {
      'Spring': 1,
      'Summer': 2,
      'Fall': 3,
      'Winter': 4
    };
    
    const aOrder = seasonOrder[a.season as keyof typeof seasonOrder] || 0;
    const bOrder = seasonOrder[b.season as keyof typeof seasonOrder] || 0;
    
    return aOrder - bOrder;
  });
}

/**
 * Sorts teams by season in reverse chronological order (newest to oldest)
 * @param teams Array of TeamSeason objects to sort
 * @returns Sorted array of teams (newest to oldest)
 */
export function sortTeamsBySeasonDesc(teams: TeamSeason[]): TeamSeason[] {
  return sortTeamsBySeason(teams).reverse();
}
