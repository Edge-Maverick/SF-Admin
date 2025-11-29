public with sharing class LicenseUtilizationHelper {
    private static final String MODULE_LU = 'License Utilization';
    List<String> lstExclusionUL;
    List<String> lstCriticalUL;

    public LicenseUtilizationHelper() {
        lstExclusionUL = AdminItemRuleService.getDoNotShowItems('UserLicence', MODULE_LU);
        lstCriticalUL = AdminItemRuleService.getAlwaysShowCriticalItems('UserLicence', MODULE_LU);
    }
    
    public LicenceUtilizationWrapper getUserLicences(){
        List<LicenseUsageWrapper> lstUserLicenses = new List<LicenseUsageWrapper>();
        List<Datetime> lstUpdatedDatetimes = new List<Datetime>();
        for(UserLicense ul: [SELECT MasterLabel,TotalLicenses,UsedLicenses,UsedLicensesLastUpdated FROM UserLicense WHERE Status='Active' AND Name NOT IN :lstExclusionUL LIMIT 1000]){
            lstUserLicenses.add(new LicenseUsageWrapper(ul));
            lstUpdatedDatetimes.add(ul.UsedLicensesLastUpdated);
        }

        if(lstUserLicenses.size() > 0){
            LicenceUtilizationWrapper wrapper = new LicenceUtilizationWrapper();
            wrapper.lstLicenceUsage = lstUserLicenses;
            wrapper.lastUpdated = getRoughDatetimeSummary(lstUpdatedDatetimes);
            wrapper.lstCriticalLicences = lstCriticalUL;
            wrapper.dormantUsers = getDormantUsers();
            return wrapper;
        }
        return null;
    }

    private String getRoughDatetimeSummary(List<Datetime> dtList) {
        if (dtList == null || dtList.isEmpty()) return 'No values';

        // Sort the list
        dtList.sort();

        Datetime first = dtList[0];
        Datetime last = dtList[dtList.size() - 1];

        Long diffMs = Math.abs(last.getTime() - first.getTime());
        Long diffMinutes = diffMs / (1000 * 60);

        // Rule 1: All values same (or extremely close)
        if (diffMinutes == 0) {
            return 'Exact: ' + first.format();
        }

        // Calculate average datetime
        Long totalMs = 0;
        for (Datetime d : dtList){totalMs += d.getTime();}
        Datetime avg = Datetime.newInstance(totalMs / dtList.size());

        // Rule 2: All times within 5 mins
        if (diffMinutes <= 5) {
            return 'Approx: ' + avg.format();
        }

        // Rule 3: More than 5 mins difference → ± 15 mins terminology
        Datetime plus15  = avg.addMinutes(15);
        Datetime minus15 = avg.addMinutes(-15);

        return 'Approx Range: ' +
            minus15.format() +
            ' to ' +
            plus15.format();
    }
    
    private Integer getDormantUsers(){
        return 
        [
            SELECT count() 
            FROM User 
            WHERE IsActive = TRUE 
            AND ( LastLoginDate < LAST_N_DAYS:90 OR (LastLoginDate=null AND CreatedDate < LAST_N_DAYS:30) )
            AND Profile.UserLicenseId NOT IN :lstExclusionUL
        ];
    } 


    public class LicenseUsageWrapper{
        @AuraEnabled public String Label{get;set;}
        @AuraEnabled public Integer TotalLicenses{get;set;}
        @AuraEnabled public Integer UsedLicenses{get;set;}
        @AuraEnabled public Integer Percent{get;set;}

        public LicenseUsageWrapper(sObject sobj){
            Label = (String)sobj.get('MasterLabel');
            TotalLicenses = (Integer)sobj.get('TotalLicenses');
            UsedLicenses = (Integer)sobj.get('UsedLicenses');

            Percent = (Integer)((UsedLicenses/TotalLicenses)*100);
        }
    }
    public class LicenceUtilizationWrapper{
        @AuraEnabled public List<LicenseUsageWrapper> lstLicenceUsage{get;set;}
        @AuraEnabled public String lastUpdated{get;set;}
        @AuraEnabled public List<String> lstCriticalLicences{get;set;}
        @AuraEnabled public Integer dormantUsers{get;set;}
    }
}