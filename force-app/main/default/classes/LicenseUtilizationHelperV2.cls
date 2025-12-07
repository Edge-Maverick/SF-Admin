public with sharing class LicenseUtilizationHelperV2 {
    
    private static final String OBJECT_USERLICENSE = 'UserLicense';
    private static final String OBJECT_PSLICENSE = 'PermissionSetLicense';

    private String strMODULE;

    public LicenseUtilizationHelperV2(String strModule) {
        this.strMODULE = strModule;
    }

    /* Warapper classes */
    public class LicenseUsageWrapper{
        @AuraEnabled public String label{get;set;}
        @AuraEnabled public Integer totalLicenses{get;set;}
        @AuraEnabled public Integer assignedLicenses{get;set;}
        @AuraEnabled public Integer activeLicenses{get;set;}
        @AuraEnabled public String category{get;set;} //behaviour
        @AuraEnabled public Decimal unitcost{get;set;}

        public LicenseUsageWrapper(String strLabel, Integer intTL, Integer intAL, Integer intActive, String strCategory, Decimal decUnitCost){
            label = strLabel;
            totalLicenses = intTL;
            assignedLicenses = intAL;
            activeLicenses = intActive;
            category = strCategory;
            unitcost = decUnitCost;
        }
    }
    public class LicenseUtilizationWrapper{
        @AuraEnabled public List<LicenseUsageWrapper> lstUserLicenseMetrics{get;set;}
        @AuraEnabled public List<LicenseUsageWrapper> lstPSLicenseMetrics{get;set;}
        @AuraEnabled public List<LicenseUsageWrapper> lstFeatureLicenseMetrics{get;set;}
    }

    public LicenseUtilizationWrapper getLicenseUtilization(){
        LicenseUtilizationWrapper wrapper = new LicenseUtilizationWrapper();
        wrapper.lstUserLicenseMetrics = getUserLicenses();
        //wrapper.lstPSLicenseMetrics = getPSLicenses();
        //wrapper.lstFeatureLicenseMetrics = getFeatureLicenses();
        return wrapper;
    }

    // USERLICENSE
    private List<LicenseUsageWrapper> getUserLicenses(){
        List<LicenseUsageWrapper> lstUserLicenses = new List<LicenseUsageWrapper>();

        Map<String,Integer> mapActiveUserPerLicences = getActiveUserPerLicences();
        Map<String,AdminItemRule__c> mapAdminItemRules = AdminItemRuleService.getAdminItemRules(OBJECT_USERLICENSE, this.strMODULE );

        for(UserLicense objUL : [SELECT 
            MasterLabel,TotalLicenses,UsedLicenses 
            FROM UserLicense 
            WHERE Status='Active'])
        {
            String strBih;
            Decimal decUnitCost = 1;
            if(mapAdminItemRules!=null && mapAdminItemRules.containsKey(objUL.MasterLabel)){
                if(AdminItemRuleService.DO_NOT_SHOW.equalsIgnoreCase(mapAdminItemRules.get(objUL.MasterLabel).Behavior__c)){ continue; }
                strBih = mapAdminItemRules.get(objUL.MasterLabel).Behavior__c;
                decUnitCost = mapAdminItemRules.get(objUL.MasterLabel).UnitCost__c;
            }
            lstUserLicenses.add(
                new LicenseUsageWrapper(
                    objUL.MasterLabel, 
                    (Integer)objUL.TotalLicenses, 
                    (Integer)objUL.UsedLicenses, 
                    mapActiveUserPerLicences.get(objUL.MasterLabel)!=null?mapActiveUserPerLicences.get(objUL.MasterLabel):0, 
                    strBih, 
                    decUnitCost
                )
            );
        }

        return lstUserLicenses;
    }
    private Map<String,Integer> getActiveUserPerLicences(){
        Map<String,Integer> mapActiveUserPerLicences = new Map<String,Integer>();
        for(AggregateResult ar: [
            SELECT Profile.UserLicense.MasterLabel, count(id) 
            FROM User 
            WHERE IsActive=TRUE AND LastLoginDate = LAST_N_DAYS:30 
            GROUP BY Profile.UserLicense.MasterLabel
        ])
        {
            mapActiveUserPerLicences.put((String)ar.get('MasterLabel'),(Integer)ar.get('expr0'));
        }
        return mapActiveUserPerLicences;
    }


    private List<LicenseUsageWrapper> getPSLicenses(){
        List<LicenseUsageWrapper> lstPSLicenses = new List<LicenseUsageWrapper>();
        return lstPSLicenses;
    }
    private List<LicenseUsageWrapper> getFeatureLicenses(){
        List<LicenseUsageWrapper> lstFeatureLicenses = new List<LicenseUsageWrapper>();
        return lstFeatureLicenses;
    }
}