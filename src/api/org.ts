import * as vscode from 'vscode';
import { Org, AuthInfo, ConfigAggregator, OrgConfigProperties } from '@salesforce/core';
import { OrgInfo } from '../types';

async function resolveTargetOrg(): Promise<string> {
  await ConfigAggregator.clearInstance();
  const configAggregator = await ConfigAggregator.create();
  await configAggregator.reload();

  const targetOrg = configAggregator.getPropertyValue(
    OrgConfigProperties.TARGET_ORG
  ) as string | undefined;

  if (targetOrg) {
    return targetOrg;
  }

  const authorizations = await AuthInfo.listAllAuthorizations();
  const valid = authorizations.filter(a => !a.error && a.isExpired !== true);

  if (valid.length === 0) {
    throw new Error(
      'No authorized orgs found. Please run "SFDX: Authorize an Org" first.'
    );
  }

  if (valid.length === 1) {
    return valid[0].aliases?.[0] ?? valid[0].username;
  }

  const items = valid.map(a => ({
    label: a.aliases?.[0] ?? a.username,
    description: a.aliases?.[0] ? a.username : undefined,
    detail: a.instanceUrl,
    value: a.aliases?.[0] ?? a.username,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'No default org set. Select an org to use:',
    ignoreFocusOut: true,
  });

  if (!picked) {
    throw new Error('No org selected.');
  }

  return picked.value;
}

export async function getOrgInfo(): Promise<OrgInfo> {
  try {
    const targetOrg = await resolveTargetOrg();

    const org = await Org.create({ aliasOrUsername: targetOrg });
    const connection = org.getConnection();
    const fields = connection.getAuthInfoFields();

    return {
      status: 0,
      result: {
        id: fields.orgId ?? '',
        accessToken: connection.accessToken ?? '',
        instanceUrl: connection.instanceUrl,
        username: fields.username ?? targetOrg,
        clientId: fields.clientId ?? '',
        connectedStatus: 'Connected',
        alias: fields.alias,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to get org info. Make sure you have authorized an org via "SFDX: Authorize an Org". Error: ${message}`
    );
  }
}
