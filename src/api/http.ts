/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as https from 'https';

export async function callSalesforceApi(
  instanceUrl: string,
  accessToken: string,
  endpoint: string,
  queryParams?: Record<string, string>
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, instanceUrl);
    
    // Add query parameters if provided
    if (queryParams) {
      Object.keys(queryParams).forEach(key => {
        url.searchParams.append(key, queryParams[key]);
      });
    }
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          reject(new Error(`Failed to parse API response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request failed: ${error.message}`));
    });

    req.end();
  });
}

export async function putSalesforceApi(
  instanceUrl: string,
  accessToken: string,
  endpoint: string,
  body: unknown
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, instanceUrl);
    const bodyString = JSON.stringify(body);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const statusCode = res.statusCode ?? 0;
        
        try {
          if (!data || data.trim() === '') {
            resolve({ 
              success: statusCode >= 200 && statusCode < 300,
              statusCode,
              message: 'No content returned'
            });
            return;
          }
          
          const parsed = JSON.parse(data);
          
          if (statusCode >= 400) {
            reject(new Error(`API error (${statusCode}): ${JSON.stringify(parsed, null, 2)}`));
            return;
          }
          
          resolve({
            statusCode,
            ...parsed
          });
        } catch {
          if (statusCode >= 400) {
            reject(new Error(`API error (${statusCode}): ${data}`));
          } else {
            resolve({ 
              success: true,
              statusCode,
              rawResponse: data 
            });
          }
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request failed: ${error.message}`));
    });

    req.write(bodyString);
    req.end();
  });
}

export async function postSalesforceApi(
  instanceUrl: string,
  accessToken: string,
  endpoint: string,
  body: unknown
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, instanceUrl);
    const bodyString = JSON.stringify(body);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const statusCode = res.statusCode ?? 0;
        
        try {
          if (!data || data.trim() === '') {
            resolve({ 
              success: statusCode >= 200 && statusCode < 300,
              statusCode,
              message: 'No content returned'
            });
            return;
          }
          
          const parsed = JSON.parse(data);
          
          if (statusCode >= 400) {
            reject(new Error(`API error (${statusCode}): ${JSON.stringify(parsed, null, 2)}`));
            return;
          }
          
          resolve(parsed);
        } catch {
          if (statusCode >= 400) {
            reject(new Error(`API error (${statusCode}): ${data}`));
          } else {
            resolve({ 
              success: true,
              statusCode,
              rawResponse: data 
            });
          }
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request failed: ${error.message}`));
    });

    req.write(bodyString);
    req.end();
  });
}