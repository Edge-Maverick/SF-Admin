public with sharing class AdminPulseController {
    
    public class LimitAlert {
        @AuraEnabled public String name;
        @AuraEnabled public Integer percentUsed;
        @AuraEnabled public String message;
        @AuraEnabled public Boolean isCritical;
    }

    @AuraEnabled(cacheable=true)
    public static List<LimitAlert> getOrgLimitStatus() {
        List<LimitAlert> alerts = new List<LimitAlert>();
        Map<String, System.OrgLimit> limits = System.OrgLimits.getMap();
        
        // Critical limits to monitor
        Set<String> criticalKeys = new Set<String>{
            'DailyApiRequests', 
            'DataStorageMB', 
            'FileStorageMB',
            'DailyAsyncApexExecutions',
            'HourlyDashboardRefreshes'
        };

        for(String key : criticalKeys) {
            if(limits.containsKey(key)) {
                System.OrgLimit lim = limits.get(key);
                if(lim.getLimit() > 0) {
                    Decimal usage = Decimal.valueOf(lim.getValue()) / Decimal.valueOf(lim.getLimit());
                    if(usage >= 0.85) {
                        LimitAlert alert = new LimitAlert();
                        alert.name = lim.getName();
                        alert.percentUsed = (Integer)(usage * 100);
                        alert.message = 'Critical usage: ' + alert.percentUsed + '%';
                        alert.isCritical = true;
                        alerts.add(alert);
                    }
                }
            }
        }
        
        return alerts;
    }
}
