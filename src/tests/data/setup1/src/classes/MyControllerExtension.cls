public with sharing class MyControllerExtension {

	private final Account acc;

    public String var1 {
        get{
            if(acc.name == 'testing'){
                return 'foo';
            }else{
                return 'bar';
            }
        }
    }

    public String var2{
        get; set{
            var2 = value;
            System.debug(value);
        }
    }

    // The extension constructor initializes the private member
    // variable mysObject by using the getRecord method from the standard
    // controller.
    public MyControllerExtension(ApexPages.StandardController stdController) {
        this.acc = (Account)stdController.getRecord();
        var2 = 'Testing';
    }

    public void loadAction(){
        System.debug(this.acc);
        acc.name = 'testing';
        Integer randomInt = getAccountNumber();
        acc.AccountNumber = String.valueOf(randomInt);
        for(Integer i = 0; i < 5; i++){
            acc.AccountNumber = String.valueOf(Integer.valueOf(acc.AccountNumber) + 1);
            System.debug(acc.AccountNumber);
        }
    }

    private static Integer getAccountNumber(){
        return Math.round(Math.random()*100);
    }

    public PageReference fooBar(){
        Type t = Bar.class;
        Bar barInstance = (Bar) t.newInstance();
        Boolean b = barInstance.method1('testing');
        System.debug(b);
        return null;
    }
}