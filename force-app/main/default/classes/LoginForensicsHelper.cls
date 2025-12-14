public with sharing class LoginForensicsHelper {
    private static Map<String,String> mapConfigIDtoName = new Map<String,String>();

    public LoginForensicsHelper() {
        mapConfigIDtoName = new Map<String,String>();
        for (SamlSsoConfig config : [SELECT Id,DeveloperName, Issuer, Version FROM SamlSsoConfig]) {
            mapConfigIDtoName.put(config.Id, config.DeveloperName);
        }
        for (AuthProvider config:[SELECT Id,ProviderType,FriendlyName FROM AuthProvider LIMIT 200]) {
            mapConfigIDtoName.put(config.Id, config.FriendlyName);
        }
    }

    public class LoginConfigWrapper{
        @AuraEnabled public Map<String,List<String>> loginGateways{get;set;}
        @AuraEnabled public String logoutUrl{get;set;}
        @AuraEnabled public String loginForensicsUrl{get;set;}
    }
    public class SingleConfigWrapper{
        @AuraEnabled public String label{get;set;}
        @AuraEnabled public Integer value{get;set;}
        @AuraEnabled public Integer total{get;set;}
    }

    @AuraEnabled(cacheable=true)
    public static LoginConfigWrapper getLoginConfig(){
        LoginConfigWrapper wrapper = new LoginConfigWrapper();

        /*Map<String,Object> mapMyDomainSettings = (Map<String,Object>) (SalesforceRequestService.getQuery('SELECT CanOnlyLoginWithMyDomainUrl, DoesApiLoginRequireOrgDomain FROM MyDomainSettings LIMIT 1', true)[0]); //fetch the first item as there can always be only one.
        
        if ( !(Boolean)mapMyDomainSettings.get(CanOnlyLoginWithMyDomainUrl) ){ new List<String>{'Username - Password', 'Log In with Email'}; } // production org.
        if ( !(Boolean)mapMyDomainSettings.get(DoesApiLoginRequireOrgDomain) ){ wrapper.]*/

        //wrapper.logoutUrl = '';
        return wrapper;
    }




    /**
     * Wrapper class to hold the data in a format optimized for Tree Charts
     */
    public class LoginPathData {
        @AuraEnabled public String path;        // The hierarchy: "Login URL / App / Status"
        @AuraEnabled public Integer userCount;  // The line width (Node Size)
        @AuraEnabled public String colorKey;    // The color grouping: "URL + App"
        
        public LoginPathData(String url, String app, String status, Integer count) {
            // We sanitize nulls to ensure the tree renders correctly
            String safeUrl = (url == null) ? 'Unknown URL' : url.replace('https://', '').replace('/', '');
            String safeApp = (app == null) ? 'Unknown App' : app;
            String safeStatus = (status == null) ? 'Unknown Status' : status;

            // Construct the path string expected by many Tree visualizations (e.g., D3/Observable)
            // Format: "Entry Point / Application / Outcome"
            this.path = safeUrl + '/' + safeApp + '/' + safeStatus;
            
            // This key allows the UI to assign the same color to the same App/URL combo
            this.colorKey = safeUrl + ' - ' + safeApp;
            
            this.userCount = count;
        }
    }

    /**
     * Fetches aggregated login history data.
     * LIMITATION NOTE: LoginHistory is a "Big Object" behavior. 
     * We limit to LAST_N_DAYS:7 to prevent query timeouts in large orgs.
     */
    @AuraEnabled(cacheable=true)
    public static List<LoginPathData> getLoginTreeData() {
        List<LoginPathData> treeData = new List<LoginPathData>();
        List<AggregateResult> arList = new List<AggregateResult>();
        try {
            arList = 
                [SELECT LoginUrl, Application, Status, COUNT_DISTINCT(UserId) uniqueUsers
                FROM LoginHistory
                WHERE LoginTime = LAST_N_DAYS:7 AND UserId NOT IN (SELECT Id FROM USER WHERE Username LIKE '%@00d%')
                GROUP BY LoginUrl, Application, Status
                ORDER BY COUNT_DISTINCT(UserId) DESC
                LIMIT 2000];
        } catch (Exception e){
            throw new AuraHandledException('Error fetching login history: ' + e.getMessage());
        }

        try {
            // We group by URL (Where), Application (How), and Status (Outcome)
            // We use COUNT_DISTINCT(UserId) to show the number of unique people, not total attempts
            for (AggregateResult ar : arList) {
                String url = (String)ar.get('LoginUrl');
                String app = (String)ar.get('Application');
                String status = (String)ar.get('Status');
                Integer count = (Integer)ar.get('uniqueUsers');

                treeData.add(new LoginPathData(url, app, status, count));
            }
        } catch (Exception e) {
            // Gracefully handle query timeouts or permissions issues
            throw new AuraHandledException('Error analyzing login history: ' + e.getMessage());
        }

        return treeData;
    }
}