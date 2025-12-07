public class PostInstallClass implements InstallHandler {
  public void onInstall(InstallContext context) {
    if(context.previousVersion() == null) {
      /* ONINSTALL Create AdminRuleItem__c records */
      
    }
    else{
      if(context.previousVersion().compareTo(new Version(1,0)) == 0) {

      }
      if(context.isUpgrade()) {

      }
      if(context.isPush()) {

      }
    }
  }
}