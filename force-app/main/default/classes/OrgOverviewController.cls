public with sharing class OrgOverviewController {
    @AuraEnabled(cacheable=true)
    public static Organization getOrganizationDetails() {
        return [SELECT Id, Name, OrganizationType, InstanceName, IsSandbox FROM Organization LIMIT 1];
    }

    @AuraEnabled(cacheable=true)
    public static ReleaseInfo getUpcomingRelease() {
        Organization org = [SELECT InstanceName FROM Organization LIMIT 1];
        String instanceName = org.InstanceName;
        
        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://api.status.salesforce.com/v1/maintenances?instance=' + instanceName + '&limit=1000&offset=0');
        req.setMethod('GET');
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        if (res.getStatusCode() == 200) {
            List<Object> maintenances = (List<Object>) JSON.deserializeUntyped(res.getBody());
            for (Object obj : maintenances) {
                Map<String, Object> m = (Map<String, Object>) obj;
                String releaseType = (String) m.get('releaseType');
                Boolean isCore = (Boolean) m.get('isCore');
                String plannedStartTimeStr = (String) m.get('plannedStartTime');
                
                if ('Major'.equalsIgnoreCase(releaseType) && isCore == true) {
                    DateTime plannedStartTime = (DateTime) JSON.deserialize('"' + plannedStartTimeStr + '"', DateTime.class);
                    if (plannedStartTime > DateTime.now()) {
                        ReleaseInfo info = new ReleaseInfo();
                        info.name = (String) m.get('name');
                        info.releaseDate = plannedStartTime.date();
                        info.daysRemaining = Date.today().daysBetween(info.releaseDate);
                        return info;
                    }
                }
            }
        }
        return null;
    }

    public class ReleaseInfo {
        @AuraEnabled public String name;
        @AuraEnabled public Date releaseDate;
        @AuraEnabled public Integer daysRemaining;
    }
}
