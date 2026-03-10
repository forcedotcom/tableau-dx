import { exec } from 'child_process';
import { promisify } from 'util';
import { OrgInfo } from '../types';

const execAsync = promisify(exec);

export async function getOrgInfo(): Promise<OrgInfo> {
  try {
    const { stdout } = await execAsync('sf org display --json');
    const orgInfo: OrgInfo = JSON.parse(stdout);
    
    if (orgInfo.status !== 0) {
      throw new Error('SF CLI returned non-zero status');
    }
    
    return orgInfo;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to run 'sf org display'. Make sure you have the Salesforce CLI installed and are authenticated. Error: ${message}`
    );
  }
}
