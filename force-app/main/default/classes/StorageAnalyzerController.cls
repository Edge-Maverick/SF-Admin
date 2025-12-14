public with sharing class StorageAnalyzerController {
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getStorageData() {
        Map<String, Object> result = new Map<String, Object>();
        
        // 1. Get Org Limits
        Map<String, System.OrgLimit> limitsMap = System.OrgLimits.getMap();
        System.OrgLimit dataStorage = limitsMap.get('DataStorageMB');
        System.OrgLimit fileStorage = limitsMap.get('FileStorageMB');
        
        result.put('dataStorage', new Map<String, Object>{
            'value' => dataStorage.getValue(),
            'limit' => dataStorage.getLimit(),
            'usage' => (Double)dataStorage.getValue() / (Double)dataStorage.getLimit()
        });
        
        result.put('fileStorage', new Map<String, Object>{
            'value' => fileStorage.getValue(),
            'limit' => fileStorage.getLimit(),
            'usage' => (Double)fileStorage.getValue() / (Double)fileStorage.getLimit()
        });

        // 2. Get Object Statistics
        result.put('objectStats', getObjectStats());
        
        return result;
    }

    private static List<ObjectStat> getObjectStats() {
        List<ObjectStat> stats = new List<ObjectStat>();
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
        
        // Priority list of standard objects to check
        Set<String> targetObjects = new Set<String>{
            'Account', 'Contact', 'Opportunity', 'Lead', 'Case', 
            'Task', 'Event', 'Campaign', 'Note', 'Attachment', 'User'
        };
        
        // Add Custom Objects
        for(String key : gd.keySet()){
            if(key.endsWith('__c')){
                targetObjects.add(key);
            }
        }

        Integer queryCount = 0;
        for(String objName : targetObjects){
            if(queryCount >= 90) break; // Safety buffer for SOQL limits (max 100)
            
            Schema.SObjectType sot = gd.get(objName);
            if(sot == null) continue;
            
            Schema.DescribeSObjectResult describe = sot.getDescribe();
            if(!describe.isQueryable() || !describe.isAccessible()) continue;

            try {
                // Using COUNT() is fast and doesn't retrieve rows
                Integer count = Database.countQuery('SELECT COUNT() FROM ' + objName);
                
                if(count > 0){
                    stats.add(new ObjectStat(
                        describe.getLabel(),
                        objName,
                        count,
                        describe.isCustom(),
                        describe.getKeyPrefix()
                    ));
                }
                queryCount++;
            } catch (Exception e) {
                System.debug('Error counting ' + objName + ': ' + e.getMessage());
            }
        }
        
        stats.sort();
        return stats;
    }

    public class ObjectStat implements Comparable {
        @AuraEnabled public String label;
        @AuraEnabled public String apiName;
        @AuraEnabled public Integer count;

        @AuraEnabled public Boolean isCustom;
        @AuraEnabled public String keyPrefix;

        public ObjectStat(String label, String apiName, Integer count, Boolean isCustom, String keyPrefix){
            this.label = label;
            this.apiName = apiName;
            this.count = count;
            this.isCustom = isCustom;
            this.keyPrefix = keyPrefix;
        }

        public Integer compareTo(Object compareTo) {
            ObjectStat other = (ObjectStat) compareTo;
            if (this.count == other.count) return 0;
            if (this.count > other.count) return -1; // Sort Descending
            return 1;
        }
    }
}
