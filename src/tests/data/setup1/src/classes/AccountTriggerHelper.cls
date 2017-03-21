public with sharing class AccountTriggerHelper extends FooBase implements TriggerHandler.HandlerInterface{

    public void handle(){
        List<Account> accounts = (List<Account>) trigger.new;

        if(Trigger.isBefore){
            System.debug('Before Trigger');
            for(Account acc : accounts){
                if(!validateAccount(acc)){
                    acc.addError('MUST HAVE WEBSITE!!!');
                }
            }
        }else if(Trigger.isAfter){
            for(Account acc : (List<Account>) trigger.new){
                try{
                    Contact c = [SELECT Id FROM Contact WHERE AccountId = :acc.Id];
                }catch(Exception e){
                    getContacts(acc.Id);
                }
            }
        }
    }

    @future
    private static void getContacts(Id accId){
        RestClient1 rc = new RestClient1();
        rc.retrieveUsers();

        List<Contact> contacts = new List<Contact>();
        for(RestClient1DTO.User user : rc.users){
            Contact c = user.toSObject();
            c.AccountId = accId;
            contacts.add(c);
        }
        insert contacts;
    }
}