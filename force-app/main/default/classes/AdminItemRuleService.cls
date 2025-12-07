public with sharing class AdminItemRuleService {

    public static final String DO_NOT_SHOW = 'DoNotShow';
    public static final String ALWAYS_SHOW = 'AlwaysShow';
    public static final String CRITICAL = 'Critical';
    public static final String MAIN_FIELD = 'ItemLabel__c'; //all the methods in this class will return a list of values specified in this variable.
    public static final Integer MAX_ITEMS = 200;

    public static List<String> getDoNotShowItems(String objectName, String module){
        return getAdminItemRules(objectName, module, DO_NOT_SHOW);
    }
    public static List<String> getAlwaysShowItems(String objectName, String module){
        return getAdminItemRules(objectName, module, ALWAYS_SHOW);
    }
    public static List<String> getCriticalItems(String objectName, String module){
        return getAdminItemRules(objectName, module, CRITICAL);
    }
    public static List<String> getAdminItemRules(String objectName, String module, String behavior){
        List<String> lstItems = new List<String>();
        
        //escape single quotes
        objectName = String.escapeSingleQuotes(objectName);
        module = String.escapeSingleQuotes(module);
        behavior = String.escapeSingleQuotes(behavior);

        if(module == null || behavior == null){
            throw new CustomException('Null value for module or behavior. Please check your input.');
        }

        String dynamicQuery = 
        'SELECT '+ MAIN_FIELD+ ' FROM AdminItemRule__c WHERE IsActive__c=TRUE AND Module__c = :module AND Behavior__c = :behavior '; //mandatory filters ( IsActive =TRUE )

        if(objectName!=null && String.isNotBlank(objectName)){
            dynamicQuery = dynamicQuery + ' AND objectAPIName__c= :objectName ';
        }

        dynamicQuery = dynamicQuery + ' LIMIT :MAX_ITEMS '; //LIMIT is appended
        System.debug(dynamicQuery);

        for (AdminItemRule__c air : Database.query(dynamicQuery, AccessLevel.SYSTEM_MODE))
        {
            lstItems.add((String)air.get(MAIN_FIELD));
        }

        return lstItems;
    }

    public static Map<String,AdminItemRule__c> getAdminItemRules(String objectName, String module){
        Map<String,AdminItemRule__c> mapItems = new Map<String,AdminItemRule__c>();

        //escape single quotes
        objectName = String.escapeSingleQuotes(objectName);
        module = String.escapeSingleQuotes(module);

        if(module == null){
            throw new CustomException('Null value for module. Please check your input.');
        }

        for(AdminItemRule__c air : [SELECT ItemLabel__c,Behavior__c,UnitCost__c FROM AdminItemRule__c WHERE IsActive__c = TRUE AND Module__c = :module AND objectAPIName__c = :objectName LIMIT 5000 ] ){
            mapItems.put(air.ItemLabel__c,air);
        }
        return mapItems;
    }

    //Custom Exception class
    public class CustomException extends Exception {

    }
}