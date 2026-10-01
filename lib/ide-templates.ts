/**
 * Starter Code Boilerplate Templates for supported programming languages.
 */
export const STARTER_TEMPLATES: Record<string, string> = {
  python: `import sys

def main():
    # Read input from standard input:
    # Single line: line = sys.stdin.readline().strip()
    # All tokens:  tokens = sys.stdin.read().split()
    pass

if __name__ == "__main__":
    main()
`,

  c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    // Write your solution here
    
    return 0;
}
`,

  cpp: `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
using namespace std;

int main() {
    // Fast I/O
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Write your solution here
    
    return 0;
}
`,

  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Write your solution here
        
        scanner.close();
    }
}
`,
};
