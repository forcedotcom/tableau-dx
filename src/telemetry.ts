/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import { ExtensionContext } from 'vscode';
import {
  ServiceProvider,
  ServiceType,
  TelemetryServiceInterface,
} from '@salesforce/vscode-service-provider';

const EXTENSION_NAME = 'Salesforce-Semantic-DX';

let telemetryService: TelemetryServiceInterface | undefined;

export async function initTelemetry(context: ExtensionContext): Promise<void> {
  try {
    let isAvailable = false;
    for (let i = 0; i < 5; i++) {
      isAvailable = await ServiceProvider.isServiceAvailable(ServiceType.Telemetry);
      if (isAvailable) { break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!isAvailable) {
      console.log('Telemetry service not available after retries.');
      return;
    }

    telemetryService = await ServiceProvider.getService(
      ServiceType.Telemetry,
      EXTENSION_NAME
    );
    await telemetryService.initializeService(context);
  } catch (e) {
    console.log('Failed to initialize telemetry:', e);
  }
}

export function sendActivationEvent(startTime: number): void {
  telemetryService?.sendExtensionActivationEvent(startTime);
}

export function sendDeactivationEvent(): void {
  telemetryService?.sendExtensionDeactivationEvent();
}

export function sendCommandEvent(commandName: string, startTime?: number): void {
  telemetryService?.sendCommandEvent(commandName, startTime);
}

export function sendException(name: string, message: string): void {
  telemetryService?.sendException(name, message);
}

export function sendEventData(
  eventName: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>
): void {
  telemetryService?.sendEventData(eventName, properties, measurements);
}

export function disposeTelemetry(): void {
  telemetryService?.dispose();
}