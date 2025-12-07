public with sharing class LicenseUtilizationHelper {
    
    private static final String MODULE_LU = 'License Utilization';

    private static final String OBJECT_USERLICENCE = 'UserLicence';
    private static final String OBJECT_PSLICENCE = 'PermissionSetLicense';
    

    public LicenseUtilizationHelper() {

    }
    
    public LicenceUtilizationWrapper getLicenceUtilization(){
        LicenceUtilizationWrapper wrapper = new LicenceUtilizationWrapper();
        wrapper.lstLicenceUsage = getUserLicences();
        wrapper.lstPSLicenceUsage = getPSLicences();
        wrapper.dormantUsers = getDormantUsers();
        wrapper.lstPSMetricUsage = getPermSetLicenceMetrics();
        wrapper.lstFeatureMetricUsage = getFeatureLicenceMetrics();
        return wrapper;
    }
    public List<LicenseUsageWrapper> getUserLicences(){
        List<LicenseUsageWrapper> lstUserLicenses = new List<LicenseUsageWrapper>();
        Map<String,Integer> mapActiveUserPerLicences = getActiveUserPerLicences();
        
        List<String> lstCriticalUL = new List<String>();
        lstCriticalUL = AdminItemRuleService.getCriticalItems(OBJECT_USERLICENCE, MODULE_LU);

        for(UserLicense ul: 
        [
            SELECT 
            MasterLabel,TotalLicenses,UsedLicenses 
            FROM UserLicense 
            WHERE Status='Active' AND MasterLabel NOT IN :AdminItemRuleService.getDoNotShowItems(OBJECT_USERLICENCE, MODULE_LU) 
            LIMIT 1000
        ])
        {
            lstUserLicenses.add(new LicenseUsageWrapper(ul, lstCriticalUL.contains(ul.MasterLabel), mapActiveUserPerLicences.get(ul.MasterLabel) ));
        }
        return lstUserLicenses;
    }
    
    private List<LicenseUsageWrapper> getPSLicences(){
        List<LicenseUsageWrapper> lstPermSetLicences = new List<LicenseUsageWrapper>();
        List<String> lstCriticalUL = new List<String>();
        lstCriticalUL = AdminItemRuleService.getCriticalItems(OBJECT_PSLICENCE, MODULE_LU);

        for(PermissionSetLicense psl:
        [  
            SELECT 
            MasterLabel,TotalLicenses,UsedLicenses 
            FROM PermissionSetLicense 
            WHERE Status='Active' AND MasterLabel NOT IN :AdminItemRuleService.getDoNotShowItems(OBJECT_PSLICENCE, MODULE_LU)
        ])
        {
            lstPermSetLicences.add(new LicenseUsageWrapper(psl, lstCriticalUL.contains(psl.MasterLabel)) );
        }
        return lstPermSetLicences;
    }
    private Integer getDormantUsers(){
        return
            [
                SELECT count() 
                FROM User 
                WHERE IsActive = TRUE 
                AND ( LastLoginDate < LAST_N_DAYS:90 OR (LastLoginDate=null AND CreatedDate < LAST_N_DAYS:30) )
            ];
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
    private List<ActivePermSetLicenseMetric> getPermSetLicenceMetrics(){
        return
            [
                SELECT MasterLabel, TotalLicenses, AssignedUserCount, ActiveUserCount, MetricsDate 
                FROM ActivePermSetLicenseMetric 
            ];
    }
    private List<ActiveFeatureLicenseMetric> getFeatureLicenceMetrics(){
        return
            [
                SELECT FeatureType, TotalLicenseCount, AssignedUserCount, ActiveUserCount, MetricsDate 
                FROM ActiveFeatureLicenseMetric 
            ];
    }


    public class LicenseUsageWrapper{
        @AuraEnabled public String label{get;set;}
        @AuraEnabled public Integer totalLicenses{get;set;}
        @AuraEnabled public Integer usedLicenses{get;set;}
        @AuraEnabled public Integer mothlyActiveLicenses{get;set;}
        @AuraEnabled public Decimal percent{get;set;}
        @AuraEnabled public Boolean isCritical{get;set;}

        public LicenseUsageWrapper(sObject sobj, Boolean critical){
            label = (String)sobj.get('MasterLabel');
            totalLicenses = (Integer)sobj.get('TotalLicenses');
            usedLicenses = (Integer)sobj.get('UsedLicenses');

            percent = (Decimal)((UsedLicenses/TotalLicenses)*100);

            isCritical = critical;
        }
        public LicenseUsageWrapper(sObject sobj, Boolean critical, Integer mau){
            label = (String)sobj.get('MasterLabel');
            totalLicenses = (Integer)sobj.get('TotalLicenses');
            usedLicenses = (Integer)sobj.get('UsedLicenses');

            mothlyActiveLicenses = mau;

            percent = (Decimal)((UsedLicenses/TotalLicenses)*100);

            isCritical = critical;
        }
    }
    public class LicenseMetricWrapper{
        @AuraEnabled public String metricLabel{get;set;}
        @AuraEnabled public String metricType{get;set;}
        @AuraEnabled public Integer metricValue{get;set;}
        @AuraEnabled public Date metricDate{get;set;}
        @AuraEnabled public Boolean isCritical{get;set;}

        public LicenseMetricWrapper(String mlabel, String mType, Integer mValue, Date mDate, Boolean critical ){
            metricLabel = mlabel;
            metricType = mType;
            metricValue = mValue;
            metricDate = mDate;
            isCritical = critical;
        }
    }
    public class LicenceUtilizationWrapper{
        @AuraEnabled public List<LicenseUsageWrapper> lstLicenceUsage{get;set;}
        @AuraEnabled public List<LicenseUsageWrapper> lstPSLicenceUsage{get;set;}
        @AuraEnabled public Integer dormantUsers{get;set;}
        @AuraEnabled public List<ActivePermSetLicenseMetric> lstPSMetricUsage{get;set;}
        @AuraEnabled public List<ActiveFeatureLicenseMetric> lstFeatureMetricUsage{get;set;}
    }
}