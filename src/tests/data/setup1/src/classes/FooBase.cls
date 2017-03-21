public virtual class FooBase {

    public Boolean validateAccount(Account acc){
        if(acc.Website == null){
            return false;
        }
        return true;
    }
}