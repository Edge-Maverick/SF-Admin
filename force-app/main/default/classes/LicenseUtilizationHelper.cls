public with sharing class LicenseUtilizationHelper {
    
    private static final String OBJECT_USERLICENSE = 'UserLicense';
    private static final String OBJECT_PSLICENSE = 'PermissionSetLicense';
    private static final String OBJECT_FEATURELICENSE = 'FeatureLicense';

    private String strMODULE;
    private List<LicenseUsageWrapper> globalKpis;

    public LicenseUtilizationHelper(String strModule) {
        this.strMODULE = strModule;
        this.globalKpis = new List<LicenseUsageWrapper>();
    }

    /* Warapper classes */
    public class LicenseUsageWrapper{
        @AuraEnabled public String label{get;set;}
        @AuraEnabled public Integer totalLicenses{get;set;}
        @AuraEnabled public Integer assignedLicenses{get;set;}
        @AuraEnabled public Integer availableLicenses{get;set;}
        @AuraEnabled public Integer activeLicenses{get;set;}
        @AuraEnabled public Integer dormantLicenses{get;set;}
        @AuraEnabled public String category{get;set;} //behaviour
        @AuraEnabled public Decimal unitcost{get;set;}
       
        public LicenseUsageWrapper(String strLabel){
            label = strLabel;
            totalLicenses = 0;
            assignedLicenses = 0;
            availableLicenses = 0;
            activeLicenses = 0;
            dormantLicenses = 0;
        }

        public LicenseUsageWrapper(String strLabel, Integer intTL, Integer intAL, Integer intActive, String strCategory, Decimal decUnitCost){
            label = strLabel;
            totalLicenses = intTL;
            assignedLicenses = intAL;
            availableLicenses = intTl - intAL;
            activeLicenses = intActive;
            dormantLicenses = intAL - intActive;
            category = strCategory;
            unitcost = decUnitCost;
        }
    }
    public class LicenseWrapper{
        @AuraEnabled public List<LicenseUsageWrapper> lstMetrics{get;set;}
        @AuraEnabled public List<String> lstCategories{get;set;}
        @AUraEnabled public String strMetricsDate{get;set;}
    }
    public class LicenseUtilizationWrapper{
        @AuraEnabled public List<LicenseUsageWrapper> globalKpis{get;set;}
        @AuraEnabled public LicenseWrapper userLicense{get;set;}
        @AuraEnabled public LicenseWrapper psLicense{get;set;}
        @AuraEnabled public LicenseWrapper featureLicense{get;set;}
    }

    public LicenseUtilizationWrapper getLicenseUtilization(){
        LicenseUtilizationWrapper wrapper = new LicenseUtilizationWrapper();
        wrapper.userLicense = getUserLicenses();
        wrapper.psLicense = getPSLicenses();
        wrapper.featureLicense = getFeatureLicenses();
        wrapper.globalKpis = this.globalKpis; // globalKpis is a class level variable that contains the global kpis
        return wrapper;
    }

    // USERLICENSE
    private LicenseWrapper getUserLicenses(){
        Set<String> setCategories = new Set<String>();
        List<LicenseUsageWrapper> lstUserLicenses = new List<LicenseUsageWrapper>();
        LicenseUsageWrapper objGlobalKpi = new LicenseUsageWrapper(OBJECT_USERLICENSE);

        Map<String,Integer> mapActiveUserPerLicenses = getActiveUserPerLicenses();
        Map<String,AdminItemRule__c> mapAdminItemRules = AdminItemRuleService.getAdminItemRules(OBJECT_USERLICENSE, this.strMODULE );

        for(UserLicense objUL : [SELECT 
            MasterLabel,TotalLicenses,UsedLicenses 
            FROM UserLicense 
            WHERE Status='Active'])
        {
            String strBehavior;
            Decimal decUnitCost = 1;
            if(mapAdminItemRules!=null && mapAdminItemRules.containsKey(objUL.MasterLabel)){
                strBehavior = mapAdminItemRules.get(objUL.MasterLabel).Behavior__c;

                if(AdminItemRuleService.DO_NOT_SHOW.equalsIgnoreCase(strBehavior)){ continue; }
                else{ // else it is Category
                    strBehavior = mapAdminItemRules.get(objUL.MasterLabel).Category__c;
                    setCategories.addAll(strBehavior.split(';'));
                }
                decUnitCost = mapAdminItemRules.get(objUL.MasterLabel).UnitCost__c;
            }
            LicenseUsageWrapper objWrapper = new LicenseUsageWrapper(
                    objUL.MasterLabel, 
                    (Integer)objUL.TotalLicenses, 
                    (Integer)objUL.UsedLicenses, 
                    mapActiveUserPerLicenses.get(objUL.MasterLabel)!=null?mapActiveUserPerLicenses.get(objUL.MasterLabel):0, 
                    strBehavior, 
                    decUnitCost
                );
            lstUserLicenses.add( objWrapper);

            objGlobalKpi.totalLicenses += objWrapper.totalLicenses;
            objGlobalKpi.assignedLicenses += objWrapper.assignedLicenses;
            objGlobalKpi.availableLicenses += objWrapper.availableLicenses;
            objGlobalKpi.activeLicenses += objWrapper.activeLicenses;
            objGlobalKpi.dormantLicenses += objWrapper.dormantLicenses;
            
        }
        this.globalKpis.add(objGlobalKpi);

        LicenseWrapper wrapper = new LicenseWrapper();
        wrapper.lstCategories = new List<String>(setCategories);
        wrapper.lstMetrics = lstUserLicenses;
        return wrapper;
    }
    private Map<String,Integer> getActiveUserPerLicenses(){
        Map<String,Integer> mapActiveUserPerLicenses = new Map<String,Integer>();
        for(AggregateResult ar: [
            SELECT Profile.UserLicense.MasterLabel, count(id) 
            FROM User 
            WHERE IsActive=TRUE AND LastLoginDate = LAST_N_DAYS:30 
            GROUP BY Profile.UserLicense.MasterLabel
        ])
        {
            mapActiveUserPerLicenses.put((String)ar.get('MasterLabel'),(Integer)ar.get('expr0'));
        }
        return mapActiveUserPerLicenses;
    }

    // PERMISION SET LICENSE
    private LicenseWrapper getPSLicenses(){
        List<LicenseUsageWrapper> lstPSLicenses = new List<LicenseUsageWrapper>();
        Set<String> setCategories = new Set<String>();
        LicenseUsageWrapper objGlobalKpi = new LicenseUsageWrapper(OBJECT_PSLICENSE);

        Map<String,Integer> mapActiveUserPerLicenses = getActiveUserPerPSLicenses();
        Map<String,AdminItemRule__c> mapAdminItemRules = AdminItemRuleService.getAdminItemRules(OBJECT_PSLICENSE, this.strMODULE );

        for(PermissionSetLicense objUL : [SELECT 
            MasterLabel,TotalLicenses,UsedLicenses 
            FROM PermissionSetLicense 
            WHERE Status='Active'])
        {
            String strBehavior;
            Decimal decUnitCost = 1;
            if(mapAdminItemRules!=null && mapAdminItemRules.containsKey(objUL.MasterLabel)){
                strBehavior = mapAdminItemRules.get(objUL.MasterLabel).Behavior__c;

                if(AdminItemRuleService.DO_NOT_SHOW.equalsIgnoreCase(strBehavior)){ continue; }
                else{ // else it is Category
                    strBehavior = mapAdminItemRules.get(objUL.MasterLabel).Category__c;
                    setCategories.addAll(strBehavior.split(';'));
                }
                decUnitCost = mapAdminItemRules.get(objUL.MasterLabel).UnitCost__c;
            }
            LicenseUsageWrapper objWrapper = new LicenseUsageWrapper(
                    objUL.MasterLabel, 
                    (Integer)objUL.TotalLicenses, 
                    (Integer)objUL.UsedLicenses, 
                    mapActiveUserPerLicenses.get(objUL.MasterLabel)!=null?mapActiveUserPerLicenses.get(objUL.MasterLabel):0, 
                    strBehavior, 
                    decUnitCost
                );
            lstPSLicenses.add( objWrapper);

            objGlobalKpi.totalLicenses += objWrapper.totalLicenses;
            objGlobalKpi.assignedLicenses += objWrapper.assignedLicenses;
            objGlobalKpi.availableLicenses += objWrapper.availableLicenses;
            objGlobalKpi.activeLicenses += objWrapper.activeLicenses;
            objGlobalKpi.dormantLicenses += objWrapper.dormantLicenses;
            
        }
        this.globalKpis.add(objGlobalKpi);

        LicenseWrapper wrapper = new LicenseWrapper();
        wrapper.lstCategories = new List<String>(setCategories);
        wrapper.lstMetrics = lstPSLicenses;
        return wrapper;
    }
    private Map<String,Integer> getActiveUserPerPSLicenses(){
        Map<String,Integer> mapActiveUserPerLicenses = new Map<String,Integer>();
        for(AggregateResult ar: [
            SELECT PermissionSetLicense.MasterLabel, count(id) 
            FROM PermissionSetLicenseAssign 
            WHERE Assignee.IsActive=TRUE AND Assignee.LastLoginDate = LAST_N_DAYS:30 
            GROUP BY PermissionSetLicense.MasterLabel
        ])
        {
            mapActiveUserPerLicenses.put((String)ar.get('MasterLabel'),(Integer)ar.get('expr0'));
        }
        return mapActiveUserPerLicenses;
    }

    // FEATURE LICENSE
    private LicenseWrapper getFeatureLicenses(){
        List<LicenseUsageWrapper> lstFeatureLicenses = new List<LicenseUsageWrapper>();
        Set<String> setCategories = new Set<String>();
        LicenseUsageWrapper objGlobalKpi = new LicenseUsageWrapper(OBJECT_FEATURELICENSE);

        Map<String,AdminItemRule__c> mapAdminItemRules = AdminItemRuleService.getAdminItemRules(OBJECT_FEATURELICENSE, this.strMODULE );

        AggregateResult[] groupedResults = [SELECT MAX(MetricsDate) FROM ActiveFeatureLicenseMetric];
         Date latestMetricsDate = (Date)groupedResults[0].get('expr0');

        for(ActiveFeatureLicenseMetric objUL : [
            SELECT FeatureType,
                   TotalLicenseCount,
                   AssignedUserCount,
                   ActiveUserCount,
                   MetricsDate
            FROM ActiveFeatureLicenseMetric
            WHERE MetricsDate = :latestMetricsDate
            ORDER BY FeatureType])
        {
            String strBehavior;
            Decimal decUnitCost = 1;
            if(mapAdminItemRules!=null && mapAdminItemRules.containsKey(objUL.FeatureType)){
                strBehavior = mapAdminItemRules.get(objUL.FeatureType).Behavior__c;

                if(AdminItemRuleService.DO_NOT_SHOW.equalsIgnoreCase(strBehavior)){ continue; }
                else{ // else it is Category
                    strBehavior = mapAdminItemRules.get(objUL.FeatureType).Category__c;
                    setCategories.addAll(strBehavior.split(';'));
                }
                decUnitCost = mapAdminItemRules.get(objUL.FeatureType).UnitCost__c;
            }
            LicenseUsageWrapper objWrapper = new LicenseUsageWrapper(
                    objUL.FeatureType, 
                    (Integer)objUL.TotalLicenseCount, 
                    (Integer)objUL.AssignedUserCount, 
                    (Integer)objUL.ActiveUserCount, 
                    strBehavior, 
                    decUnitCost
                );
            lstFeatureLicenses.add(objWrapper);

            objGlobalKpi.totalLicenses += objWrapper.totalLicenses;
            objGlobalKpi.assignedLicenses += objWrapper.assignedLicenses;
            objGlobalKpi.availableLicenses += objWrapper.availableLicenses;
            objGlobalKpi.activeLicenses += objWrapper.activeLicenses;
            objGlobalKpi.dormantLicenses += objWrapper.dormantLicenses;

        }
        
        this.globalKpis.add(objGlobalKpi);

        LicenseWrapper wrapper = new LicenseWrapper();
        wrapper.lstCategories = new List<String>(setCategories);
        wrapper.lstMetrics = lstFeatureLicenses;
        wrapper.strMetricsDate = latestMetricsDate.format();
        return wrapper;
    }
}