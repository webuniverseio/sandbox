/**
 * @file Event driven Sandbox implementation with permission management for modular architecture
 * 1) sandbox can send and receive inside itself
 2) order of listeners and notifications doesn't matter, data should be cached and cache should be cleaned (with every delivered message or by timeout)
 3) sandbox manager can control who gets notifications from whom (allow/deny)
 4) sandbox can be destroyed to free resources
 * @author Sergey Zarouski, http://webuniverse.ca
 * @licence MIT
 */