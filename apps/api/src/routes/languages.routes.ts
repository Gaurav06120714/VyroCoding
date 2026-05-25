import { FastifyInstance } from 'fastify';
import { Language } from '@vyro/types';

interface LanguageEntry {
  id: number;
  name: string;
  monacoId: string;
  version: string;
  starterTemplate: string;
}

const LANGUAGE_LIST: LanguageEntry[] = [
  {
    id: Language.JavaScript,
    name: 'JavaScript (Node.js 18)',
    monacoId: 'javascript',
    version: 'Node.js 18.x',
    starterTemplate: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function solution(nums, target) {
  // Write your solution here

}`,
  },
  {
    id: Language.Python,
    name: 'Python 3',
    monacoId: 'python',
    version: 'Python 3.11',
    starterTemplate: `class Solution:
    def solution(self, nums: list[int], target: int) -> list[int]:
        # Write your solution here
        pass`,
  },
  {
    id: Language.Cpp,
    name: 'C++ (GCC 9.2)',
    monacoId: 'cpp',
    version: 'GCC 9.2',
    starterTemplate: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    vector<int> solution(vector<int>& nums, int target) {
        // Write your solution here

    }
};`,
  },
  {
    id: Language.Java,
    name: 'Java (OpenJDK 13)',
    monacoId: 'java',
    version: 'OpenJDK 13',
    starterTemplate: `class Solution {
    public int[] solution(int[] nums, int target) {
        // Write your solution here

    }
}`,
  },
  {
    id: Language.TypeScript,
    name: 'TypeScript',
    monacoId: 'typescript',
    version: 'TypeScript 5.x',
    starterTemplate: `function solution(nums: number[], target: number): number[] {
    // Write your solution here

}`,
  },
  {
    id: Language.Go,
    name: 'Go',
    monacoId: 'go',
    version: 'Go 1.21',
    starterTemplate: `package main

import "fmt"

func solution(nums []int, target int) []int {
    // Write your solution here

    return nil
}

func main() {
    fmt.Println(solution([]int{2, 7, 11, 15}, 9))
}`,
  },
  {
    id: Language.Rust,
    name: 'Rust',
    monacoId: 'rust',
    version: 'Rust 1.75',
    starterTemplate: `impl Solution {
    pub fn solution(nums: Vec<i32>, target: i32) -> Vec<i32> {
        // Write your solution here

        vec![]
    }
}`,
  },
];

export async function languagesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_request, reply) => {
    return reply.send({ data: LANGUAGE_LIST });
  });
}
