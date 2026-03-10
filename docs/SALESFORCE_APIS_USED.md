# Salesforce APIs Used by Semantic Layer Extension

This extension uses the following Salesforce REST APIs:

## Core Semantic Layer APIs (v65.0)

### 1. List Models
- **Endpoint:** `/services/data/v65.0/ssot/semantic/models`
- **Method:** GET
- **Purpose:** Retrieve list of all semantic models in the org
- **Used by:** List Models, Visualize Remote ERD, Validate Model, Import Model

### 2. Get Model Data Objects
- **Endpoint:** `/services/data/v65.0/ssot/semantic/models/{modelApiName}/data-objects`
- **Method:** GET
- **Purpose:** Retrieve data objects for a model
- **Used by:** Visualize ERD, Import Model, Compare ERD

### 3. Get Model Relationships
- **Endpoint:** `/services/data/v65.0/ssot/semantic/models/{modelApiName}/relationships`
- **Method:** GET
- **Purpose:** Retrieve relationships between data objects
- **Used by:** Visualize ERD, Import Model, Compare ERD

### 4. Get Calculated Dimensions
- **Endpoint:** `/services/data/v65.0/ssot/semantic/models/{modelApiName}/calculated-dimensions`
- **Method:** GET
- **Purpose:** Retrieve calculated dimension fields
- **Used by:** Visualize ERD, Import Model, Compare ERD

### 5. Get Calculated Measurements
- **Endpoint:** `/services/data/v65.0/ssot/semantic/models/{modelApiName}/calculated-measurements`
- **Method:** GET
- **Purpose:** Retrieve calculated measurement fields
- **Used by:** Visualize ERD, Import Model, Compare ERD

### 6. Get Groupings
- **Endpoint:** `/services/data/v65.0/ssot/semantic/models/{modelApiName}/groupings`
- **Method:** GET
- **Purpose:** Retrieve grouping definitions
- **Used by:** Visualize ERD, Import Model

### 7. Get Parameters
- **Endpoint:** `/services/data/v65.0/ssot/semantic/models/{modelApiName}/parameters`
- **Method:** GET
- **Purpose:** Retrieve model parameters
- **Used by:** Import Model

### 8. Get Logical Views
- **Endpoint:** `/services/data/v65.0/ssot/semantic/models/{modelApiName}/logical-views`
- **Method:** GET
- **Purpose:** Retrieve logical views in the model
- **Used by:** Visualize ERD

### 9. Get Dependencies
- **Endpoint:** `/services/data/v65.0/ssot/semantic/models/{modelApiName}/dependencies`
- **Method:** GET
- **Purpose:** Retrieve calculated field dependencies
- **Used by:** Visualize ERD, Import Model, Compare ERD

### 10. Validate Model
- **Endpoint:** `/services/data/v65.0/ssot/semantic/models/{modelApiName}/validate`
- **Method:** POST
- **Purpose:** Validate a semantic model
- **Used by:** Validate Model command

### 11. Update/Deploy Model
- **Endpoint:** `/services/data/v65.0/ssot/semantic/models/{modelApiName}`
- **Method:** PATCH
- **Purpose:** Deploy/update a semantic model to Salesforce
- **Used by:** Deploy Model command

### 12. Semantic Query Engine
- **Endpoint:** `/services/data/v65.0/semantic-engine/gateway`
- **Method:** POST
- **Purpose:** Execute semantic queries to retrieve sample data
- **Used by:** Query Sample Data feature in ERD visualization

## Organization Info APIs (v59.0)

### 13. Organization Limits
- **Endpoint:** `/services/data/v59.0/limits`
- **Method:** GET
- **Purpose:** Retrieve org limits and usage info
- **Used by:** Show Org Info command

## Authentication

All APIs require:
- **Access Token:** Obtained via Salesforce CLI (`sf org display --target-org`)
- **Instance URL:** Your Salesforce org's instance URL

## API Versions Used

- **v65.0** - Semantic Layer and SSOT APIs (primary)
- **v59.0** - Organization information APIs

## Required Salesforce Permissions

To use this extension, users need:
- Access to Semantic Layer (SSOT) features
- Read access to semantic models
- Write access to semantic models (for Deploy Model command)
- Query execution permissions (for Query Sample Data feature)
