CONTNUE THESE.

Update the existing Connector System architecture and UI form logic. The concept of a "Tool" is no longer a strict requirement; instead, "Tool" is now one of several defined Source Types. The configuration form and its available parameters must react dynamically based on the selected Source Type.

1. Form & UI State Management
The form must be completely driven by the selected Source Type. Ensure the UI updates its input fields, parameter mapping tables, and validation schemas accordingly.

2. Source Type Specifications
Implement the following behaviors based on the selected Source Type:

Type: Tool

Behavior: Requires a parameter mapper UI.

Mapping Logic: Based on the selected HTTP method (GET, POST, PUT, DELETE, PATCH), allow the user to map tool-specific parameters to the Request Body, Query Parameters, or Path Variables.

Conversion: Ensure parameters can be converted or cast to the correct data types during the mapping phase.

Type: Platform

Behavior: Requires predefined parameters necessary for platform-specific parsing and authentication. The form should render specific fields expected by the target platform.

Type: Custom

Behavior: A fully open builder interface. Allow the user to manually define the endpoint, assign custom parameters, headers, and build the payload structure from scratch.

Type: Postman

Behavior: Support Postman collection/request imports.

Environment Variables: Automatically parse Postman syntax {{variable_name}} from URLs, headers, and bodies. Provide a UI to select an Environment or map these extracted variables directly to a standard Key-Value store.

3. Agentic Integration (Tool Wrapper)
Once a connector is configured (regardless of its Source Type), the system must generate an agent-compatible interface for it.

Requirement: Expose the configured connector as an callable "Platform Tool".

Execution: Codex already understands the standard Platform Tool schema. Automatically generate the necessary tool schema (name, description, required/optional arguments) from the mapped parameters so an AI agent can natively access and execute this connector within its operational loop.


also create a platform tool PLATFORM.connector() that. can used by users in tool implementatons to call connectors.