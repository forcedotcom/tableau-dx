/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

export interface CategoryDefinition {
  name: string;
  entityKeywords: string[];
  descriptionKeywords: string[];
}

/**
 * Static mapping of well-known Salesforce DMO apiName patterns (lowercase)
 * to their Salesforce Cloud category. Checked first before keyword scoring.
 */
export const WELL_KNOWN_MAPPINGS: Record<string, string> = {
  // ── Sales Cloud ──
  'opportunity': 'Sales Cloud',
  'opportunity_product': 'Sales Cloud',
  'lead': 'Sales Cloud',
  'sales_order': 'Sales Cloud',
  'sales_order_product': 'Sales Cloud',
  'quote': 'Sales Cloud',
  'quote_line_item': 'Sales Cloud',
  'forecast': 'Sales Cloud',
  'forecast_item': 'Sales Cloud',
  'territory': 'Sales Cloud',
  'territory_model': 'Sales Cloud',
  'partner': 'Sales Cloud',
  'price_book': 'Sales Cloud',
  'price_book_entry': 'Sales Cloud',

  // ── Service Cloud ──
  'case': 'Service Cloud',
  'case_update': 'Service Cloud',
  'case_comment': 'Service Cloud',
  'case_history': 'Service Cloud',
  'entitlement': 'Service Cloud',
  'service_contract': 'Service Cloud',
  'knowledge': 'Service Cloud',
  'knowledge_article': 'Service Cloud',
  'operating_hours': 'Service Cloud',
  'sla_process': 'Service Cloud',
  'milestone': 'Service Cloud',

  // ── Marketing Cloud ──
  'campaign': 'Marketing Cloud',
  'campaign_member': 'Marketing Cloud',
  'email_engagement': 'Marketing Cloud',
  'message_engagement': 'Marketing Cloud',
  'website_engagement': 'Marketing Cloud',
  'engagement_channel_type': 'Marketing Cloud',
  'bulk_email_message': 'Marketing Cloud',
  'bulk_message': 'Marketing Cloud',
  'email_message': 'Marketing Cloud',
  'market_segment': 'Marketing Cloud',
  'digital_content': 'Marketing Cloud',
  'website_publication': 'Marketing Cloud',
  'journey': 'Marketing Cloud',
  'subscriber': 'Marketing Cloud',

  // ── Commerce Cloud ──
  'product': 'Commerce Cloud',
  'goods_product': 'Commerce Cloud',
  'catalog': 'Commerce Cloud',
  'cart': 'Commerce Cloud',
  'cart_item': 'Commerce Cloud',
  'store': 'Commerce Cloud',
  'web_store': 'Commerce Cloud',
  'promotion': 'Commerce Cloud',
  'coupon': 'Commerce Cloud',
  'wishlist': 'Commerce Cloud',
  'wishlist_item': 'Commerce Cloud',

  // ── Experience Cloud ──
  'community': 'Experience Cloud',
  'site': 'Experience Cloud',
  'network': 'Experience Cloud',
  'network_member': 'Experience Cloud',

  // ── Field Service ──
  'service_appointment': 'Field Service',
  'service_resource': 'Field Service',
  'service_territory': 'Field Service',
  'service_territory_member': 'Field Service',
  'work_order': 'Field Service',
  'work_order_line_item': 'Field Service',
  'resource_absence': 'Field Service',

  // ── Revenue Cloud ──
  'billing': 'Revenue Cloud',
  'billing_schedule': 'Revenue Cloud',
  'subscription': 'Revenue Cloud',
  'invoice': 'Revenue Cloud',
  'invoice_line': 'Revenue Cloud',
  'payment': 'Revenue Cloud',
  'payment_method': 'Revenue Cloud',
  'credit_memo': 'Revenue Cloud',
  'order': 'Revenue Cloud',
  'order_item': 'Revenue Cloud',

  // ── Data Cloud ──
  'individual': 'Data Cloud',
  'account': 'Data Cloud',
  'account_contact': 'Data Cloud',
  'contact_point_phone': 'Data Cloud',
  'contact_point_email': 'Data Cloud',
  'contact_point_address': 'Data Cloud',
  'contact_point_app': 'Data Cloud',
  'contact_point_social': 'Data Cloud',
  'contact_point_consent': 'Data Cloud',
  'party_identification': 'Data Cloud',
  'identity_resolution': 'Data Cloud',
  'unified_individual': 'Data Cloud',
  'user': 'Data Cloud',
  'user_group': 'Data Cloud',

  // ── Industry Clouds ──
  'financial_account': 'Industry Clouds',
  'insurance_policy': 'Industry Clouds',
  'claim': 'Industry Clouds',
  'claim_item': 'Industry Clouds',
  'loan': 'Industry Clouds',
  'mortgage': 'Industry Clouds',
  'patient': 'Industry Clouds',
  'care_plan': 'Industry Clouds',
  'clinical_encounter': 'Industry Clouds',
  'warranty': 'Industry Clouds',
  'manufacturing_order': 'Industry Clouds',
};

/**
 * Keyword dictionaries for scoring entities that don't match the static map.
 * entityKeywords match against apiName/label tokens.
 * descriptionKeywords match against description text.
 */
export const CLOUD_CATEGORIES: CategoryDefinition[] = [
  {
    name: 'Sales Cloud',
    entityKeywords: [
      'opportunity', 'lead', 'sales', 'forecast', 'territory',
      'quote', 'pipeline', 'deal', 'prospect', 'funnel',
      'price_book', 'competitor',
    ],
    descriptionKeywords: [
      'sales', 'opportunity', 'deal', 'pipeline', 'lead',
      'prospect', 'revenue', 'close', 'win rate', 'quota',
      'forecast', 'territory',
    ],
  },
  {
    name: 'Service Cloud',
    entityKeywords: [
      'case', 'entitlement', 'knowledge', 'sla', 'milestone',
      'operating_hours', 'service_contract', 'escalat',
      'support', 'resolution',
    ],
    descriptionKeywords: [
      'case', 'support', 'service', 'customer support', 'escalat',
      'resolution', 'ticket', 'help desk', 'sla', 'entitlement',
      'knowledge base',
    ],
  },
  {
    name: 'Marketing Cloud',
    entityKeywords: [
      'campaign', 'email_engagement', 'message_engagement',
      'website_engagement', 'engagement', 'bulk_email', 'bulk_message',
      'email_message', 'market_segment', 'digital_content',
      'website_publication', 'journey', 'subscriber', 'newsletter',
      'audience', 'marketing',
    ],
    descriptionKeywords: [
      'campaign', 'marketing', 'email', 'engagement', 'message',
      'audience', 'segment', 'journey', 'click', 'open rate',
      'bounce', 'subscriber', 'outbound', 'newsletter',
    ],
  },
  {
    name: 'Commerce Cloud',
    entityKeywords: [
      'product', 'goods', 'catalog', 'cart', 'store',
      'commerce', 'promotion', 'coupon', 'inventory', 'wishlist',
      'merchandise', 'shipping',
    ],
    descriptionKeywords: [
      'product', 'catalog', 'commerce', 'store', 'purchase',
      'buy', 'inventory', 'goods', 'merchandise', 'retail',
      'shopping', 'item for sale',
    ],
  },
  {
    name: 'Experience Cloud',
    entityKeywords: [
      'community', 'portal', 'experience', 'site', 'network',
      'forum', 'collaboration',
    ],
    descriptionKeywords: [
      'community', 'portal', 'experience', 'self-service',
      'collaboration', 'partner portal', 'customer portal',
    ],
  },
  {
    name: 'Field Service',
    entityKeywords: [
      'service_appointment', 'work_order', 'service_territory',
      'service_resource', 'field_service', 'dispatch',
      'technician', 'maintenance', 'scheduling',
    ],
    descriptionKeywords: [
      'field service', 'technician', 'appointment', 'dispatch',
      'maintenance', 'on-site', 'mobile worker', 'schedule',
      'work order',
    ],
  },
  {
    name: 'Revenue Cloud',
    entityKeywords: [
      'billing', 'subscription', 'invoice', 'contract', 'cpq',
      'revenue', 'payment', 'credit_memo', 'order',
    ],
    descriptionKeywords: [
      'billing', 'subscription', 'invoice', 'pricing', 'revenue',
      'contract', 'payment', 'recurring', 'renewal',
    ],
  },
  {
    name: 'Data Cloud',
    entityKeywords: [
      'individual', 'account', 'contact_point', 'identity',
      'unified', 'user', 'user_group', 'party', 'person',
      'contact', 'account_contact',
    ],
    descriptionKeywords: [
      'identity', 'individual', 'contact point', 'unified',
      'data cloud', 'profile', 'person', 'party', 'customer data',
      'contact information', 'data model object',
    ],
  },
  {
    name: 'Industry Clouds',
    entityKeywords: [
      'financial', 'healthcare', 'patient', 'claim', 'policy',
      'loan', 'mortgage', 'insurance', 'manufacturing',
      'warranty', 'clinical', 'care_plan',
    ],
    descriptionKeywords: [
      'financial', 'healthcare', 'patient', 'insurance',
      'manufacturing', 'industry', 'loan', 'mortgage', 'claim',
      'clinical', 'care plan',
    ],
  },
  {
    name: 'Platform',
    entityKeywords: [
      'flow', 'flow_version', 'flow_element', 'date_dim',
      'parameter', 'custom_sql', 'batch', 'log', 'audit',
      'task', 'event', 'activity', 'note', 'attachment',
    ],
    descriptionKeywords: [
      'flow', 'automation', 'process', 'utility', 'generate',
      'date dimension', 'sequence', 'system',
    ],
  },
];