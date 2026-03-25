/**
 * EXAMPLE: How to add new releases to your GitHub Pages-hosted tracker
 * 
 * This file demonstrates the ReleaseBuilder API for creating Release objects.
 * Add releases directly to src/app/services/release.service.ts in the RELEASES_SCHEDULE array.
 */

import { ReleaseBuilder } from './release.builder';

/**
 * Example 1: Basic Release
 * Minimal configuration with only required fields
 */
const basicRelease = ReleaseBuilder.from('rel-basic')
  .version('1.0.0')
  .firstTstDeploy(new Date(2026, 0, 15))     // Jan 15, 2026
  .accDeployments([{ date: new Date(2026, 0, 20) }])  // Single ACC round
  .prdDeploy(new Date(2026, 1, 1))            // Feb 1, 2026
  .branch('release/1-0')
  .build();

/**
 * Example 2: Release with Multiple ACC Rounds and Notes
 * More realistic scenario with multiple testing rounds and annotations
 */
const multiRoundRelease = ReleaseBuilder.from('rel-mar')
  .version('26.03.0')
  .firstTstDeploy(new Date(2026, 1, 20))    // Feb 20, 2026
  .accDeployments([
    { date: new Date(2026, 1, 24) },         // First ACC round - Feb 24
    { date: new Date(2026, 2, 3) },          // Second ACC round - Mar 3
    { date: new Date(2026, 2, 12), notes: 'Final ACC round' }  // Final round - Mar 12
  ])
  .prdDeploy(new Date(2026, 2, 19))          // PRD release - Mar 19
  .branch('release/26-03')
  .description('Content release for March 2026')
  .team(['Frontend Team', 'Backend Team', 'QA Team'])
  .repository('https://github.com/yourorg/yourrepo')
  .build();

/**
 * Example 3: Upcoming Release with Full Details
 */
const upcomingRelease = ReleaseBuilder.from('rel-apr')
  .version('26.04.0')
  .firstTstDeploy(new Date(2026, 2, 26))    // Mar 26, 2026
  .accDeployments([
    { date: new Date(2026, 3, 1) },          // Apr 1, 2026
    { date: new Date(2026, 3, 9) }           // Apr 9, 2026
  ])
  .prdDeploy(new Date(2026, 3, 16))          // Apr 16, 2026
  .branch('release/26-04')
  .description('UI improvements and performance optimizations')
  .team(['Release Manager', 'Tech Lead', 'DevOps'])
  .repository('https://github.com/yourorg/yourrepo')
  .build();

/**
 * ADDING YOUR RELEASES
 * =====================
 * 
 * 1. Open: src/app/services/release.service.ts
 * 
 * 2. Find the RELEASES_SCHEDULE array (around line 12)
 * 
 * 3. Add your releases using the pattern above:
 * 
 *    private static readonly RELEASES_SCHEDULE = [
 *      ReleaseBuilder.from('rel-id-1')
 *        .version('version-number')
 *        .firstTstDeploy(new Date(year, month-1, day))
 *        .accDeployments([...])
 *        .prdDeploy(new Date(year, month-1, day))
 *        .branch('release/branch-name')
 *        .description('Description here')
 *        .team(['Team 1', 'Team 2'])
 *        .build(),
 * 
 *      // Add more releases here...
 *    ];
 * 
 * 4. Save the file
 * 
 * 5. Build and deploy to GitHub Pages:
 *    npm run build
 *    # Commit and push
 */

/**
 * DATE FORMAT REFERENCE
 * ====================
 * 
 * JavaScript months are 0-indexed:
 * - January   = 0
 * - February  = 1
 * - March     = 2
 * - April     = 3
 * - May       = 4
 * - June      = 5
 * - July      = 6
 * - August    = 7
 * - September = 8
 * - October   = 9
 * - November  = 10
 * - December  = 11
 * 
 * Examples:
 * new Date(2026, 0, 15)   // January 15, 2026
 * new Date(2026, 1, 28)   // February 28, 2026
 * new Date(2026, 11, 25)  // December 25, 2026
 */

/**
 * API REFERENCE
 * =============
 * 
 * .from(id)                    - Create builder with release ID (required)
 * .version(version)            - Set version string (required), e.g. '26.03.0'
 * .firstTstDeploy(date)        - Set first TST deployment date (required)
 * .accDeployments(dates)       - Array of ACC deployment dates (required)
 *                                Each item: { date: Date, notes?: string }
 * .prdDeploy(date)             - Set PRD deployment date (required)
 * .branch(name)                - Set branch name (required), e.g. 'release/26-03'
 * .description(text)           - Optional description
 * .team(members)               - Optional array of team member names
 * .repository(url)             - Optional repository URL
 * .build()                     - Finalize and return Release object
 */

export { basicRelease, multiRoundRelease, upcomingRelease };
