import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Function as LambdaFunction, FunctionProps } from './function';
import { FunctionBase, IFunction } from './function-base';
import { Permission } from './permission';

/**
 * Properties for a newly created singleton Lambda
 */
export interface SingletonFunctionProps extends FunctionProps {
  /**
   * A unique identifier to identify this lambda
   *
   * The identifier should be unique across all custom resource providers.
   * We recommend generating a UUID per provider.
   */
  readonly uuid: string;

  /**
   * A descriptive name for the purpose of this Lambda.
   *
   * If the Lambda does not have a physical name, this string will be
   * reflected its generated name. The combination of lambdaPurpose
   * and uuid must be unique.
   *
   * @default SingletonLambda
   */
  readonly lambdaPurpose?: string;
}

/**
 * A Lambda that will only ever be added to a stack once.
 *
 * This construct is a way to guarantee that the lambda function will be guaranteed to be part of the stack,
 * once and only once, irrespective of how many times the construct is declared to be part of the stack.
 * This is guaranteed as long as the `uuid` property and the optional `lambdaPurpose` property stay the same
 * whenever they're declared into the stack.
 *
 * @resource AWS::Lambda::Function
 */
export class SingletonFunction extends FunctionBase {
  public readonly grantPrincipal: iam.IPrincipal;
  public readonly functionName: string;
  public readonly functionArn: string;
  public readonly role?: iam.IRole;
  public readonly permissionsNode: cdk.ConstructNode;
  protected readonly canCreatePermissions: boolean;
  private lambdaFunction: IFunction;

  constructor(scope: cdk.Construct, id: string, props: SingletonFunctionProps) {
    super(scope, id);

    this.lambdaFunction = this.ensureLambda(props);
    this.permissionsNode = this.lambdaFunction.node;

    this.functionArn = this.lambdaFunction.functionArn;
    this.functionName = this.lambdaFunction.functionName;
    this.role = this.lambdaFunction.role;
    this.grantPrincipal = this.lambdaFunction.grantPrincipal;

    this.canCreatePermissions = true; // Doesn't matter, addPermission is overriden anyway
  }

  public addPermission(name: string, permission: Permission) {
    return this.lambdaFunction.addPermission(name, permission);
  }

  /**
   * Using node.addDependency() does not work on this method as the underlying lambda function is modeled
   * as a singleton across the stack. Use this method instead to declare dependencies.
   */
  public addDependency(...up: cdk.IDependable[]) {
    this.lambdaFunction.node.addDependency(...up);
  }

  /**
   * The SingletonFunction construct cannot be added as a dependency of another construct using
   * node.addDependency(). Use this method instead to declare this as a dependency of another construct.
   */
  public dependOn(down: cdk.IConstruct) {
    down.node.addDependency(this.lambdaFunction);
  }

  private ensureLambda(props: SingletonFunctionProps): IFunction {
    const constructName = (props.lambdaPurpose || 'SingletonLambda') + slugify(props.uuid);
    const existing = cdk.Stack.of(this).node.tryFindChild(constructName);
    if (existing) {
      // Just assume this is true
      return existing as FunctionBase;
    }

    return new LambdaFunction(cdk.Stack.of(this), constructName, props);
  }
}

function slugify(x: string): string {
  return x.replace(/[^a-zA-Z0-9]/g, '');
}
