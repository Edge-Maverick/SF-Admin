/**
 * @description A lightweight framework to perform REST API callouts to the local Salesforce Org.
 * Handles Base URL resolution, Session ID authentication, and JSON serialization.
==== TEST REST OBJECT API ====
Map<String, Object> newAccount = new Map<String, Object>();
newAccount.put('Name', 'API Created Account');
newAccount.put('Industry', 'Technology');

try {
    HttpResponse response = SalesforceRequestService.post('/services/data/v60.0/sobjects/Account', newAccount);
    System.debug('Account Created: ' + response.getBody());
} catch (SalesforceRequestService.ApiException e) {
    System.debug('Error: ' + e.getMessage() + ' ' + e.responseBody);
}
*/
public inherited sharing class SalesforceRequestService {
    private static final String TOOLING_QUERY = '/services/data/v62.0/tooling/query?q=';
    private static final String DEFAULT_QUERY = '/services/data/v62.0/query?q=';

    // Custom Exception for API errors
    public class ApiException extends Exception {
        public Integer statusCode;
        public String responseBody;

        public ApiException(String message, Integer statusCode, String responseBody) {
            this(message);
            this.statusCode = statusCode;
            this.responseBody = responseBody;
        }
    }
    
    /**
     * @description Executes a SOQL query via REST API and returns the records array.
     * Validates HTTP status and response JSON shape: expects {"records":[...]}.
     * @param strQuery The SOQL query string
     * @param useTooling If true, uses the Tooling API endpoint; otherwise, the standard REST query endpoint
     * @return List<Object> The list of records from the query response
     * @throws ApiException When the callout fails or the response payload is invalid
     */
    public static List<Object> getQuery(String strQuery, Boolean useTooling) {
        String escapedQuery = (useTooling ? TOOLING_QUERY : DEFAULT_QUERY) + EncodingUtil.urlEncode(strQuery, 'UTF-8');
        
        // Perform GET and obtain raw response
        HttpResponse response = send('GET', escapedQuery, null);
        
        // Validate status code (send already throws on >=400, but keep defensive checks if behavior changes)
        Integer status = response.getStatusCode();
        String body = response.getBody();
        
        if (String.isBlank(body)) {
            throw new ApiException('Empty response body for query callout', status, body);
        }
        
        // Parse JSON to untyped
        Object parsed;
        try {
            parsed = JSON.deserializeUntyped(body);
        } catch (Exception e) {
            throw new ApiException('Invalid JSON in query response: ' + e.getMessage(), status, body);
        }
        
        // Validate JSON structure and extract records
        if (!(parsed instanceof Map<String, Object>)) {
            throw new ApiException('Unexpected response format: root is not a JSON object', status, body);
        }
        
        Map<String, Object> root = (Map<String, Object>) parsed;
        if (!root.containsKey('records')) {
            throw new ApiException('Unexpected response format: missing "records" property', status, body);
        }
        
        Object recordsAny = root.get('records');
        if (!(recordsAny instanceof List<Object>)) {
            throw new ApiException('Unexpected response format: "records" is not a JSON array', status, body);
        }
        
        return (List<Object>) recordsAny;
    }
    
    /**
     * @description GET Request Wrapper
     * @param path The relative path (e.g., '/services/data/v60.0/sobjects/Account/ID')
     * @return HttpResponse
     */
    public static HttpResponse get(String path) {
        return send('GET', path, null);
    }

    /**
     * return send('DELETE', path, null);
     * return send('PATCH', path, body);
     * return send('PUT', path, body);
     * return send('POST', path, body);
     */
  

    /**
     * @description Core method to build and execute the HTTP request
     */
    private static HttpResponse send(String method, String path, Object body) {
        Http http = new Http();
        HttpRequest request = new HttpRequest();

        // 1. Set the Endpoint
        // We combine the Org's Base URL with the relative path provided
        String baseUrl = URL.getOrgDomainUrl().toExternalForm();
        
        // Ensure path starts with /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        request.setEndpoint(baseUrl + path);

        // 2. Set the Method
        request.setMethod(method);

        // 3. Set Headers
        // Critical: Use the current session ID for authentication
        // NOTE: This requires the org's domain to be in Remote Site Settings
        request.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
        request.setHeader('Content-Type', 'application/json');
        request.setHeader('Accept', 'application/json');

        // 4. Set Body (if applicable)
        if (body != null) {
            String jsonBody = (body instanceof String) ? (String)body : JSON.serialize(body);
            request.setBody(jsonBody);
        }

        // 5. Execute
        try {
            HttpResponse response = http.send(request);
            
            // Optional: Auto-throw exception on 4xx/5xx errors
            // If you prefer to handle status codes in the calling method, remove this check.
            if (response.getStatusCode() >= 400) {
                throw new ApiException(
                    'Callout failed: ' + response.getStatus(), 
                    response.getStatusCode(), 
                    response.getBody()
                );
            }
            
            return response;
        } catch (System.CalloutException e) {
            // Rethrow or handle specific logging requirements here
            throw new ApiException('Network/Callout Error: ' + e.getMessage(), 0, null);
        }
    }
}