trigger AccountTrigger on Account (
	before insert,
	before update,
	before delete,
	after insert,
	after update,
	after delete,
	after undelete) {

		AccountTriggerHelper trh = new AccountTriggerHelper();
        TriggerHandler handler = new TriggerHandler();
        handler.bind(TriggerHandler.Evt.BeforeInsert, trh);
        handler.bind(TriggerHandler.Evt.AfterInsert, trh);
        handler.manage();
}